import { afterEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { LocalGitExecutionAdapter, LocalWorkspaceAdapter } from "./index";

const cleanupTargets: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupTargets.splice(0).map(async (target) => {
      try {
        await fs.rm(target, { recursive: true, force: true });
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code !== "EBUSY" && code !== "EPERM") {
          throw error;
        }
      }
    })
  );
});

function runGit(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe("LocalGitExecutionAdapter.createSandbox", () => {
  it("creates a sandbox inside the provided app-owned root and returns descriptor metadata", async () => {
    const adapter = new LocalGitExecutionAdapter();
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "git-observatory-test-"));
    cleanupTargets.push(root);

    const result = await adapter.createSandbox("learning", root, "session-123", "lesson");

    expect(result.sandbox.kind).toBe("learning");
    expect(result.sandbox.sessionId).toBe("session-123");
    expect(result.repoPath.startsWith(root)).toBe(true);
    await expect(fs.access(result.repoPath)).resolves.toBeUndefined();
  });
});

describe("large repo and lazy workspace handling", () => {
  it("truncates large status/workspace lists and lazily loads file content", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "git-observatory-test-"));
    cleanupTargets.push(root);
    await runGit(["init"], root);

    for (let index = 0; index < 75; index += 1) {
      await fs.writeFile(path.join(root, `file-${index}.txt`), `file ${index}`, "utf8");
    }

    const gitAdapter = new LocalGitExecutionAdapter();
    const workspaceAdapter = new LocalWorkspaceAdapter();

    const snapshot = await gitAdapter.inspectRepo(root);
    const workspace = await workspaceAdapter.readWorkspace(root);
    const file = await workspaceAdapter.readFile(root, "file-0.txt");

    expect(snapshot.performance.workingTreeTruncated).toBe(true);
    expect(snapshot.performance.workingTreeTotal).toBe(75);
    expect(snapshot.workingTree).toHaveLength(60);
    expect(workspace.performance.workspaceFilesTruncated).toBe(true);
    expect(workspace.files).toHaveLength(60);
    expect(workspace.files.every((item) => item.loaded === false && item.content === undefined)).toBe(true);
    expect(file?.loaded).toBe(true);
    expect(file?.content).toBe("file 0");
  }, 15000);
});

describe("remote state inspection", () => {
  it("captures upstream relation and ahead counts for a local clone with remotes", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "git-observatory-test-"));
    const remoteRoot = await fs.mkdtemp(path.join(os.tmpdir(), "git-observatory-remote-"));
    cleanupTargets.push(root, remoteRoot);

    await runGit(["init", "--bare"], remoteRoot);
    await runGit(["init"], root);
    await runGit(["config", "user.name", "Git Observatory"], root);
    await runGit(["config", "user.email", "observatory@example.com"], root);
    await fs.writeFile(path.join(root, "README.md"), "hello", "utf8");
    await runGit(["add", "README.md"], root);
    await runGit(["commit", "-m", "initial"], root);
    await runGit(["branch", "-M", "main"], root);
    await runGit(["remote", "add", "origin", remoteRoot], root);
    await runGit(["push", "-u", "origin", "main"], root);
    await fs.writeFile(path.join(root, "README.md"), "hello again", "utf8");
    await runGit(["add", "README.md"], root);
    await runGit(["commit", "-m", "second"], root);

    const adapter = new LocalGitExecutionAdapter();
    const snapshot = await adapter.inspectRepo(root);

    expect(snapshot.remoteState.currentBranchName).toBe("main");
    expect(snapshot.remoteState.upstreamRefName).toBe("origin/main");
    expect(snapshot.remoteState.ahead).toBe(1);
    expect(snapshot.remoteState.behind).toBe(0);
    expect(snapshot.remoteState.divergence).toBe("ahead");
  }, 15000);
});
