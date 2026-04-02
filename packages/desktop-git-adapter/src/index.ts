import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  GitExecutionAdapter,
  GitObjectInspection,
  GitObjectSummary,
  LessonWorkspace,
  LessonWorkspaceFile,
  LessonWorkspaceFileStatus,
  PackfileSummary,
  RecoveryCheckpoint,
  RefScope,
  RefSummary,
  RepoStateSnapshot,
  SandboxCreationResult,
  SandboxKind,
  StateTransition,
  WorkspaceAdapter,
  createEmptySnapshot,
  createEmptyWorkspace,
  classifyRisk,
  parseGitCommand
} from "@git-observatory/core-domain";
import { diffSnapshots, explainTransition } from "@git-observatory/core-analysis";

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runGit(args: string[], cwd: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const errorCode = (error as NodeJS.ErrnoException & { code?: number } | null)?.code;
      const exitCode = typeof errorCode === "number" ? errorCode : error ? 1 : 0;

      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode
      });
    });
  });
}

function parseRefScope(name: string): RefScope {
  if (name.startsWith("refs/remotes/")) {
    return "remote";
  }
  if (name.startsWith("refs/tags/")) {
    return "tag";
  }
  if (name.startsWith("refs/heads/")) {
    return "local";
  }
  return "special";
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listGitDirectory(gitDir: string, root = gitDir): Promise<RepoStateSnapshot["gitDirectory"]> {
  const output: RepoStateSnapshot["gitDirectory"] = [];
  const maxEntries = 120;
  const maxDepth = 4;

  async function walk(currentPath: string, depth: number): Promise<void> {
    if (output.length >= maxEntries || depth > maxDepth) {
      return;
    }

    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (output.length >= maxEntries) {
        break;
      }

      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(root, absolutePath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        output.push({ path: relativePath, kind: "directory" });
        await walk(absolutePath, depth + 1);
      } else {
        let preview: string | undefined;
        try {
          const stat = await fs.stat(absolutePath);
          if (stat.size > 0 && stat.size < 2048) {
            const buffer = await fs.readFile(absolutePath);
            preview = buffer.toString("utf8").replace(/\s+/g, " ").slice(0, 160);
          }
        } catch {
          preview = undefined;
        }

        output.push({ path: relativePath, kind: "file", preview });
      }
    }
  }

  await walk(gitDir, 0);
  return output;
}

function toPackSummary(input: string): PackfileSummary {
  const data = new Map<string, number>();

  for (const line of input.split(/\r?\n/)) {
    const [key, rawValue] = line.trim().split(": ");
    if (!key || !rawValue) {
      continue;
    }
    data.set(key, Number(rawValue));
  }

  return {
    count: data.get("count") ?? 0,
    sizeKiB: data.get("size") ?? 0,
    inPack: data.get("in-pack") ?? 0,
    packs: data.get("packs") ?? 0,
    sizePackKiB: data.get("size-pack") ?? 0,
    prunePackable: data.get("prune-packable") ?? 0,
    garbage: data.get("garbage") ?? 0,
    sizeGarbageKiB: data.get("size-garbage") ?? 0
  };
}

async function inspectGitRepo(repoPath: string, gitDir: string): Promise<RepoStateSnapshot> {
  const [
    statusResult,
    indexResult,
    refsResult,
    headTargetResult,
    headOidResult,
    graphResult,
    countObjectsResult,
    remoteResult,
    stashResult,
    gitDirectory,
    mergeExists,
    cherryPickExists,
    revertExists,
    bisectExists,
    rebaseApplyExists,
    rebaseMergeExists
  ] = await Promise.all([
    runGit(["status", "--porcelain=v1", "--untracked-files=all"], repoPath),
    runGit(["ls-files", "--stage"], repoPath),
    runGit(["for-each-ref", "--format=%(refname)%09%(objectname)%09%(objecttype)"], repoPath),
    runGit(["symbolic-ref", "-q", "HEAD"], repoPath),
    runGit(["rev-parse", "--verify", "HEAD"], repoPath),
    runGit(["log", "--all", "--date-order", "--format=%H%x09%T%x09%P%x09%s%x09%D", "-n", "60"], repoPath),
    runGit(["count-objects", "-v"], repoPath),
    runGit(["remote", "-v"], repoPath),
    runGit(["stash", "list"], repoPath),
    listGitDirectory(gitDir),
    exists(path.join(gitDir, "MERGE_HEAD")),
    exists(path.join(gitDir, "CHERRY_PICK_HEAD")),
    exists(path.join(gitDir, "REVERT_HEAD")),
    exists(path.join(gitDir, "BISECT_LOG")),
    exists(path.join(gitDir, "rebase-apply")),
    exists(path.join(gitDir, "rebase-merge"))
  ]);

  const workingTree = statusResult.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({
      indexStatus: line.slice(0, 1),
      workTreeStatus: line.slice(1, 2),
      path: line.slice(3).trim()
    }));

  const index = indexResult.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [meta, filePath] = line.split("\t");
      const [mode, oid, stage] = meta.split(" ");
      return {
        mode,
        oid,
        stage: Number(stage),
        path: filePath
      };
    });

  const refs: RefSummary[] = refsResult.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [name, oid, objectType] = line.split("\t");
      return {
        name,
        oid,
        objectType: (objectType as RefSummary["objectType"]) ?? "unknown",
        scope: parseRefScope(name)
      };
    });

  const commitGraph = graphResult.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [oid, treeOid, parents, subject, decorations] = line.split("\t");
      return {
        oid,
        treeOid,
        parents: parents ? parents.split(" ").filter(Boolean) : [],
        subject: subject ?? "",
        decorations: decorations ? decorations.split(",").map((item) => item.trim()).filter(Boolean) : []
      };
    });

  const objectCandidates = new Map<string, GitObjectSummary>();

  index.forEach((entry) => {
    objectCandidates.set(entry.oid, {
      oid: entry.oid,
      type: "blob",
      size: 0,
      storage: "unknown"
    });
  });

  refs.forEach((ref) => {
    objectCandidates.set(ref.oid, {
      oid: ref.oid,
      type: ref.objectType,
      size: 0,
      storage: "unknown"
    });
  });

  commitGraph.forEach((commit) => {
    objectCandidates.set(commit.oid, {
      oid: commit.oid,
      type: "commit",
      size: 0,
      storage: "unknown"
    });
    objectCandidates.set(commit.treeOid, {
      oid: commit.treeOid,
      type: "tree",
      size: 0,
      storage: "unknown"
    });
    commit.parents.forEach((parentOid) => {
      objectCandidates.set(parentOid, {
        oid: parentOid,
        type: "commit",
        size: 0,
        storage: "unknown"
      });
    });
  });

  const objects = Array.from(objectCandidates.values());

  const remotes = Array.from(
    remoteResult.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .reduce((map, line) => {
        const [name, url, kindWithParens] = line.split(/\s+/);
        const kind = kindWithParens?.replace(/[()]/g, "");
        const existing = map.get(name) ?? { name };
        if (kind === "fetch") {
          existing.fetchUrl = url;
        }
        if (kind === "push") {
          existing.pushUrl = url;
        }
        map.set(name, existing);
        return map;
      }, new Map<string, { name: string; fetchUrl?: string; pushUrl?: string }>())
      .values()
  );

  return {
    repoPath,
    capturedAt: new Date().toISOString(),
    gitDir,
    workingTree,
    index,
    refs,
    head: {
      detached: headTargetResult.exitCode !== 0,
      target: headTargetResult.exitCode === 0 ? headTargetResult.stdout.trim() : null,
      oid: headOidResult.exitCode === 0 ? headOidResult.stdout.trim() : null
    },
    objects,
    commitGraph,
    gitDirectory,
    operations: {
      mergeInProgress: mergeExists,
      rebaseInProgress: rebaseApplyExists || rebaseMergeExists,
      cherryPickInProgress: cherryPickExists,
      revertInProgress: revertExists,
      bisectInProgress: bisectExists,
      stashCount: stashResult.stdout.split(/\r?\n/).filter(Boolean).length
    },
    remotes,
    packfiles: toPackSummary(countObjectsResult.stdout),
    notes: []
  };
}

function deriveWorkspaceStatus(filePath: string, snapshot: RepoStateSnapshot): LessonWorkspaceFileStatus {
  const workingTreeEntry = snapshot.workingTree.find((item) => item.path === filePath);
  const stagedEntry = snapshot.index.find((item) => item.path === filePath);

  if (workingTreeEntry?.indexStatus === "?" && workingTreeEntry.workTreeStatus === "?") {
    return "untracked";
  }

  if (stagedEntry) {
    return "staged";
  }

  if (workingTreeEntry) {
    return "tracked";
  }

  return "committed";
}

async function readWorkspaceFiles(repoPath: string, root = repoPath): Promise<LessonWorkspaceFile[]> {
  const files: LessonWorkspaceFile[] = [];
  const maxEntries = 100;

  async function walk(currentPath: string): Promise<void> {
    if (files.length >= maxEntries) {
      return;
    }

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (files.length >= maxEntries) {
        return;
      }

      if (entry.name === ".git") {
        continue;
      }

      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(root, absolutePath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      const content = await fs.readFile(absolutePath, "utf8");
      files.push({
        path: relativePath,
        content,
        status: "tracked"
      });
    }
  }

  await walk(root);
  return files;
}

export class LocalGitExecutionAdapter implements GitExecutionAdapter {
  async inspectRepo(repoPath: string): Promise<RepoStateSnapshot> {
    const gitDirResult = await runGit(["rev-parse", "--absolute-git-dir"], repoPath);

    if (gitDirResult.exitCode !== 0) {
      return createEmptySnapshot(repoPath, ["Not a Git repository yet. Run git init to observe repository birth."]);
    }

    return inspectGitRepo(repoPath, gitDirResult.stdout.trim());
  }

  async createCheckpoint(repoPath: string): Promise<RecoveryCheckpoint> {
    const snapshot = await this.inspectRepo(repoPath);
    const dirty = snapshot.workingTree.length > 0;
    return {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      repoPath,
      headOid: snapshot.head.oid,
      headTarget: snapshot.head.target,
      dirty,
      reflogHint: snapshot.head.target
        ? `Recovery anchor: inspect reflog for ${snapshot.head.target}`
        : "Recovery anchor: inspect HEAD reflog or dangling commits."
    };
  }

  async createSandbox(kind: SandboxKind, rootPath: string, sessionId: string, name = "git-observatory"): Promise<SandboxCreationResult> {
    await fs.mkdir(rootPath, { recursive: true });
    const repoPath = await fs.mkdtemp(path.join(rootPath, `${name}-`));
    const snapshot = createEmptySnapshot(repoPath, ["Sandbox created. Run git init to begin observing Git internals."]);
    return {
      repoPath,
      snapshot,
      sandbox: {
        repoPath,
        kind,
        createdAt: new Date().toISOString(),
        sessionId
      }
    };
  }

  async inspectObject(repoPath: string, oid: string): Promise<GitObjectInspection | null> {
    const [typeResult, sizeResult, contentResult] = await Promise.all([
      runGit(["cat-file", "-t", oid], repoPath),
      runGit(["cat-file", "-s", oid], repoPath),
      runGit(["cat-file", "-p", oid], repoPath)
    ]);

    if (typeResult.exitCode !== 0) {
      return null;
    }

    const type = typeResult.stdout.trim() as GitObjectInspection["type"];
    const size = Number(sizeResult.stdout.trim() || "0");
    const storage = "unknown";
    const raw = contentResult.stdout;

    if (type === "blob") {
      return {
        type,
        oid,
        size,
        storage,
        preview: raw.slice(0, 2400)
      };
    }

    if (type === "tree") {
      const treeResult = await runGit(["ls-tree", oid], repoPath);
      const entries = treeResult.stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [meta, filePath] = line.split("\t");
          const [mode, entryType, entryOid] = meta.split(/\s+/);
          return {
            mode,
            type: (entryType as GitObjectSummary["type"]) ?? "unknown",
            oid: entryOid,
            path: filePath
          };
        });

      return {
        type,
        oid,
        size,
        storage,
        entries
      };
    }

    if (type === "commit") {
      let treeOid: string | null = null;
      const parents: string[] = [];
      let author = "";
      let committer = "";
      let inMessage = false;
      const messageLines: string[] = [];

      for (const line of raw.split(/\r?\n/)) {
        if (!inMessage) {
          if (!line.trim()) {
            inMessage = true;
            continue;
          }

          if (line.startsWith("tree ")) {
            treeOid = line.slice(5).trim();
          } else if (line.startsWith("parent ")) {
            parents.push(line.slice(7).trim());
          } else if (line.startsWith("author ")) {
            author = line.slice(7).trim();
          } else if (line.startsWith("committer ")) {
            committer = line.slice(10).trim();
          }
        } else {
          messageLines.push(line);
        }
      }

      const [subject = "", ...bodyLines] = messageLines;
      return {
        type,
        oid,
        size,
        storage,
        treeOid,
        parents,
        subject,
        body: bodyLines.join("\n").trim(),
        author,
        committer
      };
    }

    if (type === "tag") {
      let target: string | null = null;
      let tagName: string | null = null;
      let inMessage = false;
      const messageLines: string[] = [];

      for (const line of raw.split(/\r?\n/)) {
        if (!inMessage) {
          if (!line.trim()) {
            inMessage = true;
            continue;
          }

          if (line.startsWith("object ")) {
            target = line.slice(7).trim();
          } else if (line.startsWith("tag ")) {
            tagName = line.slice(4).trim();
          }
        } else {
          messageLines.push(line);
        }
      }

      return {
        type,
        oid,
        size,
        storage,
        target,
        tagName,
        message: messageLines.join("\n").trim()
      };
    }

    return {
      type: "unknown",
      oid,
      size,
      storage,
      raw: raw.slice(0, 2400)
    };
  }

  async executeCommand(repoPath: string, command: string): Promise<StateTransition> {
    const parsedCommand = parseGitCommand(command);
    const risk = classifyRisk(parsedCommand);
    const before = await this.inspectRepo(repoPath);
    const checkpoint = risk === "safe" ? undefined : await this.createCheckpoint(repoPath);
    const result = await runGit([parsedCommand.subcommand, ...parsedCommand.args], repoPath);
    const after = await this.inspectRepo(repoPath);
    const delta = diffSnapshots(before, after);
    const explanation = explainTransition(parsedCommand, delta, after);

    return {
      command,
      parsedCommand,
      risk,
      before,
      after,
      delta,
      explanation,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      exitCode: result.exitCode,
      checkpoint
    };
  }
}

export class LocalWorkspaceAdapter implements WorkspaceAdapter {
  async readWorkspace(repoPath: string): Promise<LessonWorkspace> {
    const files = (await exists(repoPath)) ? await readWorkspaceFiles(repoPath) : [];
    const snapshot = await new LocalGitExecutionAdapter().inspectRepo(repoPath);
    const normalizedFiles = files.map((file) => ({
      ...file,
      status: deriveWorkspaceStatus(file.path, snapshot)
    }));

    return {
      repoPath,
      files: normalizedFiles,
      selectedPath: normalizedFiles[0]?.path ?? null,
      terminalUnlocked: snapshot.commitGraph.length > 0 || snapshot.index.length > 0,
      modifiedAt: new Date().toISOString()
    };
  }

  async createFile(repoPath: string, filePath: string, content: string): Promise<LessonWorkspace> {
    const absolutePath = path.join(repoPath, filePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");
    const workspace = await this.readWorkspace(repoPath);
    return {
      ...workspace,
      selectedPath: filePath
    };
  }

  async updateFile(repoPath: string, filePath: string, content: string): Promise<LessonWorkspace> {
    const absolutePath = path.join(repoPath, filePath);
    await fs.writeFile(absolutePath, content, "utf8");
    const workspace = await this.readWorkspace(repoPath);
    return {
      ...workspace,
      selectedPath: filePath
    };
  }

  async deleteFile(repoPath: string, filePath: string): Promise<LessonWorkspace> {
    const absolutePath = path.join(repoPath, filePath);
    if (await exists(absolutePath)) {
      await fs.rm(absolutePath, { force: true });
    }
    const workspace = await this.readWorkspace(repoPath);
    return {
      ...workspace,
      selectedPath: workspace.files[0]?.path ?? null
    };
  }
}

export function createEmptyLessonWorkspace(repoPath: string): LessonWorkspace {
  return createEmptyWorkspace(repoPath);
}
