import {
  GitObjectInspection,
  GraphEdge,
  GraphExpansionState,
  GraphSelection,
  GraphViewModel,
  GraphVisibilityFilters,
  InspectorModel,
  InspectorTeachingModel,
  ParsedGitCommand,
  RefDelta,
  RepoStateSnapshot,
  StateDelta
} from "@git-observatory/core-domain";

function toMap<T>(items: T[], getKey: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [getKey(item), item]));
}

function diffKeys<T>(
  before: T[],
  after: T[],
  getKey: (item: T) => string,
  serialize: (item: T) => string
): string[] {
  const beforeMap = toMap(before, getKey);
  const afterMap = toMap(after, getKey);
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const changed: string[] = [];

  for (const key of keys) {
    const beforeItem = beforeMap.get(key);
    const afterItem = afterMap.get(key);

    if (!beforeItem || !afterItem || serialize(beforeItem) !== serialize(afterItem)) {
      changed.push(key);
    }
  }

  return changed.sort();
}

export function diffSnapshots(before: RepoStateSnapshot, after: RepoStateSnapshot): StateDelta {
  const beforeRefs = toMap(before.refs, (ref) => ref.name);
  const afterRefs = toMap(after.refs, (ref) => ref.name);
  const refNames = new Set([...beforeRefs.keys(), ...afterRefs.keys()]);
  const refsChanged: RefDelta[] = [];

  for (const name of refNames) {
    const beforeRef = beforeRefs.get(name);
    const afterRef = afterRefs.get(name);
    const beforeOid = beforeRef?.oid ?? null;
    const afterOid = afterRef?.oid ?? null;

    if (beforeOid !== afterOid) {
      refsChanged.push({ name, beforeOid, afterOid });
    }
  }

  return {
    workingTreeChanged: diffKeys(
      before.workingTree,
      after.workingTree,
      (file) => file.path,
      (file) => `${file.indexStatus}${file.workTreeStatus}`
    ),
    indexChanged: diffKeys(
      before.index,
      after.index,
      (entry) => `${entry.path}:${entry.stage}`,
      (entry) => `${entry.mode}:${entry.oid}`
    ),
    objectsAdded: after.objects
      .filter((object) => !before.objects.some((candidate) => candidate.oid === object.oid))
      .map((object) => object.oid),
    refsChanged: refsChanged.sort((left, right) => left.name.localeCompare(right.name)),
    headChanged:
      before.head.detached !== after.head.detached ||
      before.head.oid !== after.head.oid ||
      before.head.target !== after.head.target,
    operationsChanged: JSON.stringify(before.operations) !== JSON.stringify(after.operations),
    gitDirectoryChanged: diffKeys(
      before.gitDirectory,
      after.gitDirectory,
      (entry) => entry.path,
      (entry) => `${entry.kind}:${entry.preview ?? ""}`
    ),
    remoteChanged: diffKeys(
      before.remotes,
      after.remotes,
      (remote) => remote.name,
      (remote) => `${remote.fetchUrl ?? ""}:${remote.pushUrl ?? ""}`
    ),
    packfilesChanged: JSON.stringify(before.packfiles) !== JSON.stringify(after.packfiles)
  };
}

function formatCount(label: string, count: number): string | null {
  if (count === 0) {
    return null;
  }

  return `${label}: ${count}`;
}

export function explainTransition(
  command: ParsedGitCommand,
  delta: StateDelta,
  after: RepoStateSnapshot
): string[] {
  const subcommand = command.subcommand;
  const explanation: string[] = [];

  switch (subcommand) {
    case "init":
      explanation.push("Git created repository metadata inside .git and initialized HEAD/ref storage.");
      break;
    case "add":
      explanation.push("Git updated the index to point at staged object ids for the selected paths.");
      break;
    case "commit":
      explanation.push("Git wrote a tree object and a commit object, then moved the current branch ref.");
      break;
    case "switch":
    case "checkout":
      explanation.push("Git moved HEAD and reconciled the index and working tree with the selected target.");
      break;
    case "branch":
      explanation.push("Git changed branch refs. If HEAD did not move, only ref metadata changed.");
      break;
    case "merge":
      explanation.push("Git attempted to integrate another history. Ref, operation, index, and working tree state can all change here.");
      break;
    case "rebase":
      explanation.push("Git replayed commits onto a new base, which typically rewrites commit identities and updates rebase state files.");
      break;
    case "cherry-pick":
      explanation.push("Git replayed a selected commit onto the current branch, potentially creating a new commit object and temporary operation state.");
      break;
    case "revert":
      explanation.push("Git created or prepared inverse changes against existing history while preserving commit ancestry.");
      break;
    case "stash":
      explanation.push("Git stored working tree and index state as stash commits and refs for later restoration.");
      break;
    case "fetch":
      explanation.push("Git updated remote-tracking refs and downloaded object data without touching the current branch directly.");
      break;
    case "pull":
      explanation.push("Git combined fetch with a merge or rebase workflow, which can update remote refs, local refs, and the working state.");
      break;
    case "push":
      explanation.push("Git attempted to publish local refs and associated objects to a remote destination.");
      break;
    case "reset":
      explanation.push("Git moved refs and/or updated the index and working tree, depending on the reset mode.");
      break;
    case "restore":
      explanation.push("Git restored content from another state into the working tree and optionally the index.");
      break;
    case "gc":
      explanation.push("Git compacted repository storage and packfiles to optimize object access.");
      break;
    default:
      explanation.push("Git changed repository state. Inspect the delta panels to see which internal structures moved.");
      break;
  }

  const summaryBits = [
    formatCount("Working tree paths changed", delta.workingTreeChanged.length),
    formatCount("Index entries changed", delta.indexChanged.length),
    formatCount("Objects added", delta.objectsAdded.length),
    formatCount("Refs changed", delta.refsChanged.length),
    delta.headChanged ? "HEAD changed" : null,
    delta.operationsChanged ? "Operation-state files changed" : null,
    delta.packfilesChanged ? "Packfile metadata changed" : null
  ].filter((value): value is string => Boolean(value));

  if (summaryBits.length > 0) {
    explanation.push(summaryBits.join(" | "));
  }

  if (after.head.target) {
    explanation.push(`Current HEAD target: ${after.head.target}`);
  } else if (after.head.oid) {
    explanation.push(`HEAD is detached at ${after.head.oid.slice(0, 12)}.`);
  }

  return explanation;
}

export function summarizeDelta(delta: StateDelta): string {
  const parts = [
    `working tree ${delta.workingTreeChanged.length}`,
    `index ${delta.indexChanged.length}`,
    `objects ${delta.objectsAdded.length}`,
    `refs ${delta.refsChanged.length}`
  ];

  if (delta.headChanged) {
    parts.push("HEAD moved");
  }

  return parts.join(", ");
}

function truncate(value: string, length = 12): string {
  return value.length <= length ? value : `${value.slice(0, length)}...`;
}

function basename(filePath: string): string {
  const segments = filePath.split("/");
  return segments.at(-1) ?? filePath;
}

function shortRefName(name: string): string {
  return name
    .replace(/^refs\/heads\//, "")
    .replace(/^refs\/remotes\//, "")
    .replace(/^refs\/tags\//, "");
}

function stringifyRecord(record: unknown): string[] {
  return JSON.stringify(record, null, 2).split("\n");
}

export function createDefaultGraphVisibilityFilters(): GraphVisibilityFilters {
  return {
    showRefs: true,
    showTrees: true,
    showBlobs: true,
    showTags: true
  };
}

export function createDefaultGraphExpansionState(): GraphExpansionState {
  return {
    expandedTreeOids: []
  };
}

function commandEntry(label: string, command: string, description: string) {
  return { label, command, description };
}

function repoFilePath(repoPath: string, relativePath: string): string {
  return `${repoPath.replace(/\//g, "\\")}\\${relativePath.replace(/\//g, "\\")}`;
}

function gitFilePath(snapshot: RepoStateSnapshot, relativePath: string): string {
  return snapshot.gitDir ? `${snapshot.gitDir.replace(/\//g, "\\")}\\${relativePath.replace(/\//g, "\\")}` : `.git\\${relativePath.replace(/\//g, "\\")}`;
}

function buildTeachingModel(params: {
  snapshot: RepoStateSnapshot;
  kind: "composer" | "working-tree" | "staging" | "head" | "ref" | "commit" | "tree" | "blob";
  path?: string;
  oid?: string | null;
  refName?: string | null;
  scope?: string;
}): InspectorTeachingModel {
  const { snapshot, kind, path, oid, refName, scope } = params;

  switch (kind) {
    case "composer":
      return {
        represents: "A normal filesystem file in the repository working directory.",
        locations: [snapshot.repoPath],
        commands: [
          commandEntry("Show status", "git status --short", "See how Git classifies the file after you save it."),
          commandEntry("Hash file manually", `git hash-object "${path ?? "README.md"}"`, "See the blob hash Git would derive from the file contents.")
        ],
        notes: ["Files only become Git objects after you stage or explicitly hash them."]
      };
    case "working-tree":
      return {
        represents: "A file on disk in the checked-out working directory, not necessarily stored as a Git object yet.",
        locations: [path ? repoFilePath(snapshot.repoPath, path) : snapshot.repoPath],
        commands: [
          commandEntry("Status", "git status --porcelain", "See the working tree and index status codes for this path."),
          commandEntry("Diff", path ? `git diff -- "${path}"` : "git diff", "Compare the file on disk against the staged or committed version."),
          commandEntry("Hash object", path ? `git hash-object "${path}"` : "git hash-object <file>", "Compute the blob id for the current file contents without staging it.")
        ],
        notes: ["This is a normal file in your repo folder, not a file inside `.git`."]
      };
    case "staging":
      return {
        represents: "An index entry stored in `.git/index` that maps a path to a blob object id and mode.",
        locations: [gitFilePath(snapshot, "index")],
        commands: [
          commandEntry("List staged entries", "git ls-files --stage", "Show path, stage, mode, and blob id from the index."),
          commandEntry("Cached diff", "git diff --cached", "Show what the staged snapshot would add to the next commit.")
        ],
        notes: ["The index is a binary file. Use Git plumbing to inspect it rather than opening it directly."]
      };
    case "head":
      return {
        represents: "Git's current checkout pointer. Usually symbolic, sometimes detached.",
        locations: [gitFilePath(snapshot, "HEAD")],
        commands: [
          commandEntry("Symbolic target", "git symbolic-ref HEAD", "Show the branch ref that HEAD points to when not detached."),
          commandEntry("Current commit", "git rev-parse HEAD", "Show the commit id currently checked out."),
          commandEntry("Read file", "type .git\\HEAD", "Read the HEAD file contents directly on Windows.")
        ],
        notes: ["When detached, `.git/HEAD` stores a raw commit id instead of `ref: refs/...`."]
      };
    case "ref":
      return {
        represents: `${scope ?? "Git"} reference pointing to an object, usually a commit.`,
        locations: [
          refName ? gitFilePath(snapshot, refName.replace(/\//g, "\\")) : gitFilePath(snapshot, "packed-refs"),
          gitFilePath(snapshot, "packed-refs")
        ],
        commands: [
          commandEntry("Resolve ref", refName ? `git rev-parse "${refName}"` : "git rev-parse <ref>", "Show the object id stored in the ref."),
          commandEntry("Show refs", refName ? `git show-ref "${shortRefName(refName)}"` : "git show-ref", "List refs and their target object ids."),
          commandEntry("Read loose ref", refName && refName.startsWith("refs/heads/") ? `type .git\\refs\\heads\\${shortRefName(refName)}` : "type .git\\packed-refs", "Read the loose ref file or packed-refs entry when present.")
        ],
        notes: ["Loose refs live under `.git/refs/...`. Older or packed refs may be stored in `.git/packed-refs`."]
      };
    case "commit":
      return {
        represents: "A commit object in the object database.",
        locations: [oid ? `.git\\objects\\${oid.slice(0, 2)}\\${oid.slice(2)}` : ".git\\objects\\<xx>\\<rest>"],
        commands: [
          commandEntry("Pretty print commit", oid ? `git cat-file -p ${oid}` : "git cat-file -p <commit>", "Inspect tree pointer, parents, author, committer, and message."),
          commandEntry("One-line log", oid ? `git log --decorate --oneline -1 ${oid}` : "git log --decorate --oneline -1 <commit>", "See how the commit appears in history.")
        ],
        notes: ["Commit objects point to a tree object and zero or more parent commits."]
      };
    case "tree":
      return {
        represents: "A tree object that describes a directory snapshot inside a commit.",
        locations: [oid ? `.git\\objects\\${oid.slice(0, 2)}\\${oid.slice(2)}` : ".git\\objects\\<xx>\\<rest>"],
        commands: [
          commandEntry("Pretty print tree", oid ? `git cat-file -p ${oid}` : "git cat-file -p <tree>", "Show the tree entries exactly as Git stores them."),
          commandEntry("List tree entries", oid ? `git ls-tree ${oid}` : "git ls-tree <tree>", "List the names, modes, types, and object ids inside the tree.")
        ],
        notes: ["Trees contain names and links to blobs or nested trees. They do not store file contents themselves."]
      };
    case "blob":
      return {
        represents: "A blob object containing raw file content, without a filename.",
        locations: [oid ? `.git\\objects\\${oid.slice(0, 2)}\\${oid.slice(2)}` : ".git\\objects\\<xx>\\<rest>"],
        commands: [
          commandEntry("Pretty print blob", oid ? `git cat-file -p ${oid}` : "git cat-file -p <blob>", "Print the raw file contents stored in the blob."),
          commandEntry("Blob type", oid ? `git cat-file -t ${oid}` : "git cat-file -t <blob>", "Confirm the object type is `blob`."),
          commandEntry("Blob size", oid ? `git cat-file -s ${oid}` : "git cat-file -s <blob>", "Show the stored content size in bytes.")
        ],
        notes: ["Blob objects know nothing about paths. Trees and the index attach names to blobs."]
      };
  }
}

function pushEdge(edges: GraphEdge[], source: string, target: string, relationship: GraphEdge["relationship"]) {
  edges.push({
    id: `${relationship}:${source}:${target}`,
    source,
    target,
    relationship
  });
}

function ensureUniquePathList(value: unknown, nextPath: string): string[] {
  const existing = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  return existing.includes(nextPath) ? existing : [...existing, nextPath];
}

function blobNodeId(oid: string): string {
  return `blob:${oid}`;
}

function updateBlobNodePresentation(node: GraphViewModel["nodes"][number]) {
  const paths = Array.isArray(node.metadata.paths) ? node.metadata.paths.filter((item): item is string => typeof item === "string") : [];
  const primaryPath = paths[0] ?? (typeof node.metadata.path === "string" ? node.metadata.path : node.label);
  node.label = paths.length > 1 ? `${basename(primaryPath)} +${paths.length - 1}` : basename(primaryPath);
}

function resolveBlobCollisions(nodes: GraphViewModel["nodes"]) {
  const blobs = nodes
    .filter((node): node is GraphViewModel["nodes"][number] => node.type === "blob")
    .sort((left, right) => {
      if (left.position.x !== right.position.x) {
        return left.position.x - right.position.x;
      }
      return left.position.y - right.position.y;
    });

  const placed: Array<{ x: number; y: number }> = [];

  blobs.forEach((blob) => {
    let x = blob.position.x;
    let y = blob.position.y;
    let attempts = 0;

    while (
      placed.some((position) => Math.abs(position.x - x) < 120 && Math.abs(position.y - y) < 104) &&
      attempts < 12
    ) {
      attempts += 1;
      y += 112;
      if (attempts % 3 === 0) {
        x += 92;
      }
    }

    blob.position = { x, y };
    placed.push({ x, y });
  });
}

function buildTreeLayout(
  treeOid: string,
  parentNodeId: string,
  parentX: number,
  parentY: number,
  level: number,
  nodes: GraphViewModel["nodes"],
  edges: GraphEdge[],
  nodeIdsByOid: Map<string, string>,
  treeInspections: Record<string, GitObjectInspection | undefined>,
  visibilityFilters: GraphVisibilityFilters,
  expansionState: GraphExpansionState,
  visited = new Set<string>()
): void {
  if (visited.has(treeOid)) {
    return;
  }

  visited.add(treeOid);
  const tree = treeInspections[treeOid];
  if (!tree || tree.type !== "tree") {
    return;
  }

  const offsetX = parentX + 280;
  const baseY = parentY - ((tree.entries.length - 1) * 54) / 2;

  tree.entries.forEach((entry, index) => {
    const y = baseY + index * 108;

    if (entry.type === "blob" && visibilityFilters.showBlobs) {
      const blobId = `blob:${entry.oid}`;
      if (!nodeIdsByOid.has(entry.oid)) {
        nodes.push({
          id: blobId,
          type: "blob",
          label: basename(entry.path),
          oid: entry.oid,
          target: null,
          position: { x: offsetX, y },
          metadata: {
            oid: entry.oid,
            path: entry.path,
            mode: entry.mode,
            treeOid,
            paths: [entry.path],
            referenceCount: 1,
            reused: false
          }
        });
        nodeIdsByOid.set(entry.oid, blobId);
      } else {
        const blobNode = nodes.find((node) => node.id === blobId);
        if (blobNode) {
          const currentCount =
            typeof blobNode.metadata.referenceCount === "number" ? blobNode.metadata.referenceCount : 1;
          blobNode.metadata.referenceCount = currentCount + 1;
          blobNode.metadata.reused = currentCount + 1 > 1;
          blobNode.metadata.paths = ensureUniquePathList(blobNode.metadata.paths, entry.path);
          updateBlobNodePresentation(blobNode);
        }
      }

      pushEdge(edges, parentNodeId, blobId, "contains");
      return;
    }

    if (entry.type === "tree" && visibilityFilters.showTrees) {
      const childTreeId = `tree:${entry.oid}`;
      if (!nodeIdsByOid.has(entry.oid)) {
        nodes.push({
          id: childTreeId,
          type: "tree",
          label: entry.path,
          oid: entry.oid,
          target: null,
          position: { x: offsetX, y },
          metadata: {
            oid: entry.oid,
            path: entry.path,
            mode: entry.mode,
            parentTreeOid: treeOid
          }
        });
        nodeIdsByOid.set(entry.oid, childTreeId);
      }

      pushEdge(edges, parentNodeId, childTreeId, "contains");

      if (expansionState.expandedTreeOids.includes(entry.oid)) {
        buildTreeLayout(
          entry.oid,
          childTreeId,
          offsetX,
          y,
          level + 1,
          nodes,
          edges,
          nodeIdsByOid,
          treeInspections,
          visibilityFilters,
          expansionState,
          visited
        );
      }
    }
  });
}

export function projectGraph(params: {
  snapshot: RepoStateSnapshot;
  selection?: GraphSelection | null;
  visibilityFilters?: GraphVisibilityFilters;
  expansionState?: GraphExpansionState;
  treeInspections?: Record<string, GitObjectInspection | undefined>;
}): GraphViewModel {
  const snapshot = params.snapshot;
  const selection = params.selection ?? null;
  const visibilityFilters = params.visibilityFilters ?? createDefaultGraphVisibilityFilters();
  const expansionState = params.expansionState ?? createDefaultGraphExpansionState();
  const treeInspections = params.treeInspections ?? {};
  const nodes: GraphViewModel["nodes"] = [];
  const edges: GraphEdge[] = [];
  const nodeIdsByOid = new Map<string, string>();
  const commitY = new Map<string, number>();

  snapshot.commitGraph.forEach((commit, index) => {
    const id = `commit:${commit.oid}`;
    const y = 110 + index * 118;
    commitY.set(commit.oid, y);
    nodes.push({
      id,
      type: "commit",
      label: commit.subject || truncate(commit.oid, 10),
      oid: commit.oid,
      target: null,
      position: { x: 470, y },
      metadata: {
        oid: commit.oid,
        treeOid: commit.treeOid,
        parents: commit.parents,
        decorations: commit.decorations
      }
    });
    nodeIdsByOid.set(commit.oid, id);
  });

  const visibleRefs = visibilityFilters.showRefs
    ? snapshot.refs.filter((ref) => visibilityFilters.showTags || ref.scope !== "tag")
    : [];

  const refGroups = new Map<string, typeof visibleRefs>();
  visibleRefs.forEach((ref) => {
    const key = ref.oid || ref.name;
    const group = refGroups.get(key) ?? [];
    group.push(ref);
    refGroups.set(key, group);
  });

  visibleRefs.forEach((ref, index) => {
    const siblings = refGroups.get(ref.oid || ref.name) ?? [ref];
    const siblingIndex = siblings.findIndex((candidate) => candidate.name === ref.name);
    const targetY = commitY.get(ref.oid) ?? 110 + index * 88;
    const offset = (siblingIndex - (siblings.length - 1) / 2) * 96;
    const id = `ref:${ref.name}`;
    nodes.push({
      id,
      type: "ref",
      label: shortRefName(ref.name),
      oid: ref.oid,
      target: ref.name,
      position: { x: 220, y: targetY + offset },
      metadata: {
        name: ref.name,
        scope: ref.scope,
        objectType: ref.objectType,
        siblingCount: siblings.length,
        siblingIndex
      }
    });
  });

  const headY =
    (snapshot.head.target
      ? visibleRefs.find((ref) => ref.name === snapshot.head.target)?.oid
      : snapshot.head.oid) && snapshot.head.oid
      ? (commitY.get(snapshot.head.oid) ?? 110)
      : 110;

  nodes.push({
    id: "head",
    type: "head",
    label: "HEAD",
    oid: snapshot.head.oid,
    target: snapshot.head.target,
    position: { x: 80, y: headY },
    metadata: {
      detached: snapshot.head.detached,
      target: snapshot.head.target,
      oid: snapshot.head.oid
    }
  });

  if (visibilityFilters.showTrees) {
    const seenTrees = new Set<string>();
    snapshot.commitGraph.forEach((commit, index) => {
      if (!commit.treeOid || seenTrees.has(commit.treeOid)) {
        return;
      }
      seenTrees.add(commit.treeOid);
      const id = `tree:${commit.treeOid}`;
      nodes.push({
        id,
        type: "tree",
        label: `TREE ${truncate(commit.treeOid, 8)}`,
        oid: commit.treeOid,
        target: null,
        position: { x: 770, y: 110 + index * 118 },
        metadata: {
          oid: commit.treeOid,
          commitOid: commit.oid
        }
      });
      nodeIdsByOid.set(commit.treeOid, id);
    });
  }

  snapshot.commitGraph.forEach((commit) => {
    commit.parents.forEach((parent) => {
      if (nodeIdsByOid.has(parent)) {
        pushEdge(edges, `commit:${commit.oid}`, `commit:${parent}`, "parent");
      }
    });

    if (visibilityFilters.showTrees && nodeIdsByOid.has(commit.treeOid)) {
      pushEdge(edges, `commit:${commit.oid}`, `tree:${commit.treeOid}`, "contains");
    }
  });

  visibleRefs.forEach((ref) => {
    const targetId = nodeIdsByOid.get(ref.oid);
    if (!targetId) {
      return;
    }
    pushEdge(edges, `ref:${ref.name}`, targetId, "points-to");
  });

  if (snapshot.head.target && visibleRefs.some((ref) => ref.name === snapshot.head.target)) {
    pushEdge(edges, "head", `ref:${snapshot.head.target}`, "symbolic");
  } else if (snapshot.head.oid && nodeIdsByOid.has(snapshot.head.oid)) {
    pushEdge(edges, "head", nodeIdsByOid.get(snapshot.head.oid)!, "points-to");
  }

  if (visibilityFilters.showTrees) {
    const treeNodes = nodes.filter((node) => node.type === "tree");
    treeNodes.forEach((node) => {
      if (!node.oid || !expansionState.expandedTreeOids.includes(node.oid)) {
        return;
      }

      buildTreeLayout(
        node.oid,
        node.id,
        node.position.x,
        node.position.y,
        0,
        nodes,
        edges,
        nodeIdsByOid,
        treeInspections,
        visibilityFilters,
        expansionState
      );
    });
  }

  if (visibilityFilters.showBlobs) {
    snapshot.index.forEach((entry, index) => {
      const id = blobNodeId(entry.oid);
      const existingNode = nodes.find((node) => node.id === id);

      if (!existingNode) {
        nodes.push({
          id,
          type: "blob",
          label: basename(entry.path),
          oid: entry.oid,
          target: null,
          position: { x: 1060, y: 90 + index * 108 },
          metadata: {
            oid: entry.oid,
            path: entry.path,
            mode: entry.mode,
            paths: [entry.path],
            referenceCount: 1,
            reused: false,
            staged: true,
            stagedOnly: true,
            stagedPaths: [entry.path]
          }
        });
        nodeIdsByOid.set(entry.oid, id);
        return;
      }

      existingNode.metadata.paths = ensureUniquePathList(existingNode.metadata.paths, entry.path);
      existingNode.metadata.stagedPaths = ensureUniquePathList(existingNode.metadata.stagedPaths, entry.path);
      existingNode.metadata.staged = true;
      existingNode.metadata.stagedOnly = false;
      existingNode.metadata.reused =
        (Array.isArray(existingNode.metadata.paths) ? existingNode.metadata.paths.length : 1) > 1;
      updateBlobNodePresentation(existingNode);
    });
  }

  resolveBlobCollisions(nodes);

  return {
    nodes,
    edges,
    workingArea: snapshot.workingTree.map((file) => ({
      id: `working:${file.path}`,
      path: file.path,
      indexStatus: file.indexStatus,
      workTreeStatus: file.workTreeStatus
    })),
    stagingArea: snapshot.index.map((entry) => ({
      id: `staging:${entry.path}:${entry.stage}`,
      path: entry.path,
      oid: entry.oid,
      mode: entry.mode,
      stage: entry.stage
    })),
    selection,
    visibilityFilters
  };
}

export function buildInspectorModel(params: {
  snapshot: RepoStateSnapshot;
  graph: GraphViewModel;
  selection: GraphSelection;
  inspectedObject?: GitObjectInspection | null;
  workspaceFiles?: Array<{ path: string; content: string; status: string }>;
}): InspectorModel | null {
  const { snapshot, graph, selection, inspectedObject, workspaceFiles = [] } = params;

  if (selection.kind === "composer") {
    return {
      title: "Create a file",
      kind: "workspace composer",
      summary: "Add or edit a file in the current repository without leaving the app.",
      whatThisIs: "This is a small workspace helper for creating content that Git can then track.",
      underTheHood: "The file is written into the repository working directory. Git will only store it after you stage it.",
      teaching: buildTeachingModel({ snapshot, kind: "composer", path: "README.md" }),
      fields: [{ label: "Repository", value: snapshot.repoPath }],
      rawLines: []
    };
  }

  if (selection.kind === "working-tree") {
    const file = snapshot.workingTree.find((item) => item.path === selection.path);
    const workspaceFile = workspaceFiles.find((item) => item.path === selection.path);

    return {
      title: selection.path,
      kind: "working tree file",
      summary: "This file exists on disk in the working directory.",
      whatThisIs: "The working directory is your live checkout. Changes here exist before Git turns them into objects or stages them in the index.",
      underTheHood:
        "Git compares the current file on disk against the index entry and the checked-out commit to decide whether this path is modified, deleted, or untracked.",
      teaching: buildTeachingModel({ snapshot, kind: "working-tree", path: selection.path }),
      fields: [
        { label: "Path", value: selection.path, monospace: true },
        { label: "Index status", value: file?.indexStatus || " " },
        { label: "Work tree status", value: file?.workTreeStatus || " " },
        { label: "Workspace status", value: workspaceFile?.status ?? "unknown" }
      ],
      rawLines: workspaceFile ? workspaceFile.content.slice(0, 3000).split("\n") : []
    };
  }

  if (selection.kind === "staging") {
    const entry = snapshot.index.find((item) => item.path === selection.path && item.stage === selection.stage);
    if (!entry) {
      return null;
    }

    return {
      title: entry.path,
      kind: "index entry",
      summary: "This path is staged in the index for the next commit.",
      whatThisIs: "The index is Git's staged manifest. Each entry maps a path to an object id, file mode, and conflict stage.",
      underTheHood:
        "When you run git add, Git hashes file content into a blob object and updates the index entry to point at that object id.",
      teaching: buildTeachingModel({ snapshot, kind: "staging", path: entry.path, oid: entry.oid }),
      fields: [
        { label: "Path", value: entry.path, monospace: true },
        { label: "Stage", value: String(entry.stage) },
        { label: "Mode", value: entry.mode, monospace: true },
        { label: "Object", value: entry.oid, monospace: true }
      ],
      rawLines: stringifyRecord(entry)
    };
  }

  const node = graph.nodes.find((item) => item.id === selection.id);
  if (!node) {
    return null;
  }

  if (node.type === "head") {
    return {
      title: "HEAD",
      kind: "symbolic pointer",
      summary: snapshot.head.detached ? "HEAD points directly to a commit." : "HEAD points to the current branch ref.",
      whatThisIs: "HEAD tells Git what you currently have checked out.",
      underTheHood:
        "In normal operation HEAD stores a symbolic ref like refs/heads/main. In detached HEAD state it stores a raw commit id.",
      teaching: buildTeachingModel({ snapshot, kind: "head", oid: snapshot.head.oid }),
      fields: [
        { label: "Detached", value: snapshot.head.detached ? "yes" : "no" },
        { label: "Target", value: snapshot.head.target ?? "(detached)", monospace: true },
        { label: "OID", value: snapshot.head.oid ?? "(unborn)", monospace: true }
      ],
      rawLines: stringifyRecord(snapshot.head)
    };
  }

  if (node.type === "ref") {
    const ref = snapshot.refs.find((item) => item.name === node.target);
    if (!ref) {
      return null;
    }

    return {
      title: shortRefName(ref.name),
      kind: `${ref.scope} ref`,
      summary: "Refs are movable names that point at objects, usually commits.",
      whatThisIs: "A branch or tag is just a named reference. Branch refs usually move forward as new commits are created.",
      underTheHood:
        "Most refs live under .git/refs. Git updates them by writing a new object id when history moves.",
      teaching: buildTeachingModel({ snapshot, kind: "ref", oid: ref.oid, refName: ref.name, scope: ref.scope }),
      fields: [
        { label: "Ref name", value: ref.name, monospace: true },
        { label: "Scope", value: ref.scope },
        { label: "Object type", value: ref.objectType },
        { label: "Target oid", value: ref.oid, monospace: true }
      ],
      rawLines: stringifyRecord(ref)
    };
  }

  if (node.type === "commit") {
    const commit = inspectedObject?.type === "commit" ? inspectedObject : null;
    const graphCommit = snapshot.commitGraph.find((item) => item.oid === node.oid);

    return {
      title: commit?.subject || graphCommit?.subject || truncate(node.oid ?? "commit", 12),
      kind: "commit object",
      summary: "A commit records a tree snapshot, parent links, metadata, and a message.",
      whatThisIs: "Commits are the durable checkpoints in Git history.",
      underTheHood:
        "A commit object stores a tree pointer, zero or more parent commit ids, author/committer metadata, and the commit message body.",
      teaching: buildTeachingModel({ snapshot, kind: "commit", oid: node.oid }),
      fields: [
        { label: "OID", value: node.oid ?? "", monospace: true },
        { label: "Tree", value: commit?.treeOid ?? graphCommit?.treeOid ?? "", monospace: true },
        { label: "Parents", value: (commit?.parents ?? graphCommit?.parents ?? []).join(", ") || "(root commit)", monospace: true },
        { label: "Refs", value: snapshot.refs.filter((ref) => ref.oid === node.oid).map((ref) => shortRefName(ref.name)).join(", ") || "(none)" }
      ],
      rawLines: commit ? stringifyRecord(commit) : stringifyRecord(graphCommit ?? node.metadata)
    };
  }

  if (node.type === "tree") {
    const tree = inspectedObject?.type === "tree" ? inspectedObject : null;

    return {
      title: truncate(node.oid ?? "tree", 12),
      kind: "tree object",
      summary: "A tree object is Git's directory snapshot structure.",
      whatThisIs: "Trees map names to blobs and nested trees, which is how Git represents folders inside a commit snapshot.",
      underTheHood:
        "Commit objects point to a root tree. Each tree entry stores a mode, an object type, an object id, and a path name.",
      teaching: buildTeachingModel({ snapshot, kind: "tree", oid: node.oid }),
      fields: [
        { label: "OID", value: node.oid ?? "", monospace: true },
        { label: "Entry count", value: String(tree?.entries.length ?? 0) }
      ],
      rawLines: tree ? tree.entries.map((entry) => `${entry.mode} ${entry.type} ${entry.oid} ${entry.path}`) : stringifyRecord(node.metadata)
    };
  }

  if (node.type === "blob") {
    const blob = inspectedObject?.type === "blob" ? inspectedObject : null;

    return {
      title: node.label,
      kind: "blob object",
      summary: "A blob stores file content only, without the filename.",
      whatThisIs: "Blob objects are Git's raw content storage units.",
      underTheHood:
        "Git hashes the file contents, compresses them, and stores them as a blob. Trees and the index are what attach names and paths to blobs.",
      teaching: buildTeachingModel({ snapshot, kind: "blob", oid: node.oid }),
      fields: [
        { label: "OID", value: node.oid ?? "", monospace: true },
        { label: "Paths", value: Array.isArray(node.metadata.paths) ? node.metadata.paths.join(", ") : node.label },
        { label: "Preview bytes", value: String(blob?.preview.length ?? 0) }
      ],
      rawLines: blob ? blob.preview.split("\n") : stringifyRecord(node.metadata)
    };
  }

  return {
    title: node.label,
    kind: node.type,
    summary: "Selected graph node.",
    whatThisIs: "This is part of the repository structure graph.",
    underTheHood: "Inspect the raw metadata to see the normalized node payload behind the graph.",
    teaching: buildTeachingModel({ snapshot, kind: "blob", oid: node.oid }),
    fields: [{ label: "Node id", value: node.id, monospace: true }],
    rawLines: stringifyRecord(node)
  };
}
