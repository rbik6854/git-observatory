import {
  ChangePipelineBlob,
  ChangePipelineViewModel,
  CommandRecommendation,
  GraphNode,
  GitObjectInspection,
  GraphEdge,
  GraphExpansionState,
  HistoryGraphViewModel,
  GraphSelection,
  GraphViewModel,
  GraphVisibilityFilters,
  InspectorModel,
  InspectorTeachingModel,
  ParsedGitCommand,
  parseGitCommand,
  RefDelta,
  RemoteInspectResult,
  RemoteOperationSummary,
  RemoteViewModel,
  RepoInvalidation,
  RepoReadOptions,
  RepoStateSnapshot,
  StateDelta,
  TimelineEvent,
  TransitionJournal,
  TreeExplorerViewModel,
  WorkspaceReadOptions,
  classifyRisk
} from "@git-observatory/core-domain";

export interface GraphProjectionCache {
  signature: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

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
    remoteChanged: [
      ...diffKeys(
        before.remotes,
        after.remotes,
        (remote) => remote.name,
        (remote) => `${remote.fetchUrl ?? ""}:${remote.pushUrl ?? ""}`
      ),
      ...diffKeys(
        before.remoteState.remoteRefs,
        after.remoteState.remoteRefs,
        (ref) => ref.name,
        (ref) => `${ref.oid}:${ref.objectType}`
      ),
      ...(before.remoteState.upstreamRefName !== after.remoteState.upstreamRefName ? ["upstream"] : []),
      ...(before.remoteState.divergence !== after.remoteState.divergence ? ["divergence"] : [])
    ],
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
      if (after.remoteState.upstreamRefName) {
        explanation.push(
          `Upstream ${after.remoteState.upstreamRefName}: ahead ${after.remoteState.ahead}, behind ${after.remoteState.behind}, ${after.remoteState.divergence}.`
        );
      }
      break;
    case "pull":
      explanation.push("Git combined fetch with a merge or rebase workflow, which can update remote refs, local refs, and the working state.");
      if (after.remoteState.upstreamRefName) {
        explanation.push(
          `After pull, ${after.remoteState.currentBranchName ?? "current branch"} is ${after.remoteState.divergence} relative to ${after.remoteState.upstreamRefName}.`
        );
      }
      break;
    case "push":
      explanation.push("Git attempted to publish local refs and associated objects to a remote destination.");
      if (after.remoteState.upstreamRefName) {
        explanation.push(
          `Current upstream relation: ahead ${after.remoteState.ahead}, behind ${after.remoteState.behind}, ${after.remoteState.divergence}.`
        );
      }
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

function isIndexEntryStaged(snapshot: RepoStateSnapshot, path: string, stage: number): boolean {
  if (stage !== 0) {
    return true;
  }

  const workingTreeEntry = snapshot.workingTree.find((item) => item.path === path);
  if (!workingTreeEntry) {
    return false;
  }

  return workingTreeEntry.indexStatus.trim().length > 0 && workingTreeEntry.indexStatus !== "?";
}

function blobNodeId(oid: string): string {
  return `blob:${oid}`;
}

function buildStagingArea(snapshot: RepoStateSnapshot, delta: StateDelta | null): GraphViewModel["stagingArea"] {
  const stagedPaths = new Set<string>();
  const stagedEntries = snapshot.index.map((entry) => {
    stagedPaths.add(`${entry.path}:${entry.stage}`);
    return {
      id: `staging:${entry.path}:${entry.stage}`,
      path: entry.path,
      oid: entry.oid,
      mode: entry.mode,
      stage: entry.stage,
      indexStatus: snapshot.workingTree.find((file) => file.path === entry.path)?.indexStatus ?? "",
      emphasis: delta?.indexChanged.includes(`${entry.path}:${entry.stage}`) ? "changed" as const : "default" as const
    };
  });

  const stagedDeletes = snapshot.workingTree
    .filter((file) => file.indexStatus === "D" && !stagedPaths.has(`${file.path}:0`))
    .map((file) => ({
      id: `staging:${file.path}:0`,
      path: file.path,
      oid: "",
      mode: "",
      stage: 0,
      indexStatus: file.indexStatus,
      emphasis: delta?.workingTreeChanged.includes(file.path) ? "changed" as const : "default" as const
    }));

  return [...stagedEntries, ...stagedDeletes];
}

const HISTORY_START_X = 430;
const HISTORY_START_Y = 120;
const HISTORY_LANE_WIDTH = 170;
const HISTORY_ROW_HEIGHT = 126;
const REF_LABEL_X_OFFSET = -128;
const REF_LABEL_Y_OFFSET = 22;
const OBJECT_COLUMN_GAP = 300;
const OBJECT_CHILD_COLUMN_GAP = 260;
const INLINE_TREE_ENTRY_LIMIT = 4;
const INLINE_STAGED_BLOB_LIMIT = 4;

function formatTreeEntrySummary(entries: Extract<GitObjectInspection, { type: "tree" }>["entries"]): {
  label: string;
  fileCount: number;
  directoryCount: number;
} {
  const fileCount = entries.filter((entry) => entry.type === "blob").length;
  const directoryCount = entries.filter((entry) => entry.type === "tree").length;
  const parts: string[] = [];

  if (fileCount > 0) {
    parts.push(`${fileCount} ${fileCount === 1 ? "file" : "files"}`);
  }

  if (directoryCount > 0) {
    parts.push(`${directoryCount} ${directoryCount === 1 ? "dir" : "dirs"}`);
  }

  return {
    label: parts.length > 0 ? parts.join(" ") : "empty",
    fileCount,
    directoryCount
  };
}

function assignCommitLanes(snapshot: RepoStateSnapshot): Map<string, number> {
  const commitsByOid = toMap(snapshot.commitGraph, (commit) => commit.oid);
  const lanes = new Map<string, number>();

  function walkFirstParent(startOid: string | null | undefined, lane: number): void {
    let currentOid = startOid;
    while (currentOid && commitsByOid.has(currentOid) && !lanes.has(currentOid)) {
      lanes.set(currentOid, lane);
      currentOid = commitsByOid.get(currentOid)?.parents[0] ?? null;
    }
  }

  walkFirstParent(snapshot.head.oid, 0);

  const orderedRefs = snapshot.refs
    .filter((ref) => ref.objectType === "commit" && ref.oid && ref.oid !== snapshot.head.oid)
    .sort((left, right) => {
      const leftLocal = left.scope === "local" ? 0 : 1;
      const rightLocal = right.scope === "local" ? 0 : 1;
      if (leftLocal !== rightLocal) {
        return leftLocal - rightLocal;
      }
      return left.name.localeCompare(right.name);
    });

  let nextLane = lanes.size > 0 ? 1 : 0;
  orderedRefs.forEach((ref) => {
    if (lanes.has(ref.oid)) {
      return;
    }
    walkFirstParent(ref.oid, nextLane);
    nextLane += 1;
  });

  snapshot.commitGraph.forEach((commit) => {
    if (!lanes.has(commit.oid)) {
      lanes.set(commit.oid, nextLane);
      nextLane += 1;
    }
  });

  return lanes;
}

function updateBlobNodePresentation(node: GraphViewModel["nodes"][number]) {
  const paths = Array.isArray(node.metadata.paths) ? node.metadata.paths.filter((item): item is string => typeof item === "string") : [];
  const primaryPath = paths[0] ?? (typeof node.metadata.path === "string" ? node.metadata.path : node.label);
  node.label = basename(primaryPath);
  node.metadata.pathCount = paths.length;
  node.metadata.reused = paths.length > 1;
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

  const parentNode = nodes.find((node) => node.id === parentNodeId);
  const summary = formatTreeEntrySummary(tree.entries);
  if (parentNode) {
    parentNode.metadata.treeEntryCount = tree.entries.length;
    parentNode.metadata.treeFileCount = summary.fileCount;
    parentNode.metadata.treeDirectoryCount = summary.directoryCount;
  }

  if (tree.entries.length > INLINE_TREE_ENTRY_LIMIT) {
    if (parentNode) {
      parentNode.label = summary.label;
      parentNode.metadata.treeContentsCollapsed = true;
    }
    return;
  }

  if (parentNode) {
    parentNode.metadata.treeContentsCollapsed = false;
  }

  const offsetX = parentX + OBJECT_CHILD_COLUMN_GAP;
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

function buildGraphProjectionSignature(params: {
  snapshot: RepoStateSnapshot;
  visibilityFilters: GraphVisibilityFilters;
  expansionState: GraphExpansionState;
  treeInspections: Record<string, GitObjectInspection | undefined>;
  includeIndexBlobs: boolean;
  delta: StateDelta | null;
}): string {
  const { snapshot, visibilityFilters, expansionState, treeInspections, includeIndexBlobs, delta } = params;

  const commits = snapshot.commitGraph
    .map((commit) => `${commit.oid}:${commit.treeOid}:${commit.parents.join(",")}:${commit.subject}`)
    .join("|");
  const refs = snapshot.refs
    .map((ref) => `${ref.name}:${ref.oid}:${ref.scope}:${ref.objectType}`)
    .join("|");
  const head = `${snapshot.head.detached}:${snapshot.head.target ?? ""}:${snapshot.head.oid ?? ""}`;
  const expandedTrees = [...expansionState.expandedTreeOids].sort().join("|");
  const treeState = [...expansionState.expandedTreeOids]
    .sort()
    .map((oid) => {
      const inspection = treeInspections[oid];
      if (!inspection || inspection.type !== "tree") {
        return `${oid}:missing`;
      }

      return `${oid}:${inspection.entries.map((entry) => `${entry.type}:${entry.oid}:${entry.path}:${entry.mode}`).join(",")}`;
    })
    .join("|");
  const indexBlobs = includeIndexBlobs && visibilityFilters.showBlobs
    ? snapshot.index.map((entry) => `${entry.oid}:${entry.path}:${entry.stage}:${entry.mode}`).join("|")
    : "";
  const deltaSignature = delta
    ? [
        delta.objectsAdded.join(","),
        delta.refsChanged.map((ref) => `${ref.name}:${ref.beforeOid ?? ""}:${ref.afterOid ?? ""}`).join(","),
        delta.headChanged ? "head" : ""
      ].join("|")
    : "";

  return [
    commits,
    refs,
    head,
    JSON.stringify(visibilityFilters),
    expandedTrees,
    treeState,
    indexBlobs,
    deltaSignature
  ].join("||");
}

function buildGraphStructure(params: {
  snapshot: RepoStateSnapshot;
  visibilityFilters: GraphVisibilityFilters;
  expansionState: GraphExpansionState;
  treeInspections: Record<string, GitObjectInspection | undefined>;
  includeIndexBlobs: boolean;
  delta: StateDelta | null;
}): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const snapshot = params.snapshot;
  const visibilityFilters = params.visibilityFilters;
  const expansionState = params.expansionState;
  const treeInspections = params.treeInspections;
  const includeIndexBlobs = params.includeIndexBlobs;
  const delta = params.delta;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIdsByOid = new Map<string, string>();
  const commitY = new Map<string, number>();
  const commitX = new Map<string, number>();
  const commitLanes = assignCommitLanes(snapshot);

  snapshot.commitGraph.forEach((commit, index) => {
    const id = `commit:${commit.oid}`;
    const x = HISTORY_START_X + (commitLanes.get(commit.oid) ?? 0) * HISTORY_LANE_WIDTH;
    const y = HISTORY_START_Y + index * HISTORY_ROW_HEIGHT;
    commitY.set(commit.oid, y);
    commitX.set(commit.oid, x);
    nodes.push({
      id,
      type: "commit",
      label: commit.subject || truncate(commit.oid, 10),
      oid: commit.oid,
      target: null,
      position: { x, y },
      metadata: {
        oid: commit.oid,
        treeOid: commit.treeOid,
        parents: commit.parents,
        decorations: commit.decorations
      },
      emphasis: delta?.objectsAdded.includes(commit.oid) ? "new" : "default"
    });
    nodeIdsByOid.set(commit.oid, id);
  });

  const visibleRefs = visibilityFilters.showRefs
    ? snapshot.refs
        .filter((ref) => visibilityFilters.showTags || ref.scope !== "tag")
        .concat(
          snapshot.head.target && !snapshot.head.detached && !snapshot.refs.some((ref) => ref.name === snapshot.head.target)
            ? [
                {
                  name: snapshot.head.target,
                  oid: "",
                  objectType: "commit" as const,
                  scope: "local" as const
                }
              ]
            : []
        )
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
    const targetY = ref.oid ? (commitY.get(ref.oid) ?? HISTORY_START_Y + index * 88) : HISTORY_START_Y + index * 88;
    const targetX = ref.oid ? (commitX.get(ref.oid) ?? HISTORY_START_X) : HISTORY_START_X;
    const offset = (siblingIndex - (siblings.length - 1) / 2) * 42;
    const id = `ref:${ref.name}`;
    nodes.push({
      id,
      type: "ref",
      label: shortRefName(ref.name),
      oid: ref.oid,
      target: ref.name,
      position: { x: Math.max(40, targetX + REF_LABEL_X_OFFSET), y: Math.max(24, targetY + REF_LABEL_Y_OFFSET + offset) },
      metadata: {
        name: ref.name,
        scope: ref.scope,
        objectType: ref.objectType,
        siblingCount: siblings.length,
        siblingIndex
      },
      emphasis: delta?.refsChanged.some((candidate) => candidate.name === ref.name) ? "changed" : "default"
    });
  });

  const symbolicHeadRef = snapshot.head.target ? visibleRefs.find((ref) => ref.name === snapshot.head.target) : null;
  const symbolicHeadNode = symbolicHeadRef ? nodes.find((node) => node.id === `ref:${symbolicHeadRef.name}`) : null;
  const headY = snapshot.head.oid
    ? (commitY.get(snapshot.head.oid) ?? 110)
    : symbolicHeadRef
      ? symbolicHeadNode?.position.y ?? 110
      : 110;
  const headX = symbolicHeadNode
    ? symbolicHeadNode.position.x - 80
    : snapshot.head.oid && nodeIdsByOid.has(snapshot.head.oid)
      ? (commitX.get(snapshot.head.oid) ?? HISTORY_START_X) - 90
      : 80;

  nodes.push({
    id: "head",
    type: "head",
    label: "HEAD",
    oid: snapshot.head.oid,
    target: snapshot.head.target,
    position: { x: Math.max(40, headX), y: symbolicHeadNode ? symbolicHeadNode.position.y : headY },
    metadata: {
      detached: snapshot.head.detached,
      target: snapshot.head.target,
      oid: snapshot.head.oid
    },
    emphasis: delta?.headChanged ? "changed" : "default"
  });

  if (visibilityFilters.showTrees) {
    const seenTrees = new Set<string>();
    const objectFocusCommitOid = snapshot.head.oid ?? snapshot.commitGraph[0]?.oid ?? null;
    const objectColumnX = Math.max(...Array.from(commitX.values()), HISTORY_START_X) + OBJECT_COLUMN_GAP;
    snapshot.commitGraph.forEach((commit, index) => {
      if (!commit.treeOid || commit.oid !== objectFocusCommitOid || seenTrees.has(commit.treeOid)) {
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
        position: { x: objectColumnX, y: HISTORY_START_Y + index * HISTORY_ROW_HEIGHT },
        metadata: {
          oid: commit.treeOid,
          commitOid: commit.oid
        },
        emphasis: delta?.objectsAdded.includes(commit.treeOid) ? "new" : "default"
      });
      nodeIdsByOid.set(commit.treeOid, id);
    });
  }

  snapshot.commitGraph.forEach((commit) => {
    commit.parents.forEach((parent) => {
      if (nodeIdsByOid.has(parent)) {
        pushEdge(edges, `commit:${commit.oid}`, `commit:${parent}`, "parent");
        if (delta?.objectsAdded.includes(commit.oid)) {
          edges[edges.length - 1].emphasis = "changed";
        }
      }
    });

    if (visibilityFilters.showTrees && nodeIdsByOid.has(commit.treeOid)) {
      pushEdge(edges, `commit:${commit.oid}`, `tree:${commit.treeOid}`, "contains");
      if (delta?.objectsAdded.includes(commit.oid) || delta?.objectsAdded.includes(commit.treeOid)) {
        edges[edges.length - 1].emphasis = "changed";
      }
    }
  });

  visibleRefs.forEach((ref) => {
    if (!ref.oid) {
      return;
    }
    const targetId = nodeIdsByOid.get(ref.oid);
    if (!targetId) {
      return;
    }
    pushEdge(edges, `ref:${ref.name}`, targetId, "points-to");
    if (delta?.refsChanged.some((candidate) => candidate.name === ref.name)) {
      edges[edges.length - 1].emphasis = "changed";
    }
  });

  if (snapshot.head.target && visibleRefs.some((ref) => ref.name === snapshot.head.target)) {
    pushEdge(edges, "head", `ref:${snapshot.head.target}`, "symbolic");
    if (delta?.headChanged) {
      edges[edges.length - 1].emphasis = "changed";
    }
  } else if (snapshot.head.oid && nodeIdsByOid.has(snapshot.head.oid)) {
    pushEdge(edges, "head", nodeIdsByOid.get(snapshot.head.oid)!, "points-to");
    if (delta?.headChanged) {
      edges[edges.length - 1].emphasis = "changed";
    }
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

  if (visibilityFilters.showBlobs && includeIndexBlobs) {
    const standaloneStagedEntryKeys = new Set(
      snapshot.index
        .filter((entry) => isIndexEntryStaged(snapshot, entry.path, entry.stage))
        .map((entry) => `${entry.path}:${entry.stage}`)
    );
    const showStandaloneStagedBlobs = standaloneStagedEntryKeys.size <= INLINE_STAGED_BLOB_LIMIT;

    snapshot.index.forEach((entry, index) => {
      const id = blobNodeId(entry.oid);
      const existingNode = nodes.find((node) => node.id === id);
      const staged = isIndexEntryStaged(snapshot, entry.path, entry.stage);

      if (!existingNode && !staged) {
        return;
      }

      if (!existingNode && !showStandaloneStagedBlobs) {
        return;
      }

      if (!existingNode) {
        nodes.push({
          id,
          type: "blob",
          label: basename(entry.path),
          oid: entry.oid,
          target: null,
          position: { x: Math.max(...Array.from(commitX.values()), HISTORY_START_X) + OBJECT_COLUMN_GAP + OBJECT_CHILD_COLUMN_GAP, y: HISTORY_START_Y + index * 108 },
          metadata: {
            oid: entry.oid,
            path: entry.path,
            mode: entry.mode,
            paths: [entry.path],
            referenceCount: 1,
            reused: false,
            indexEntry: true,
            staged,
            stagedOnly: staged,
            stagedPaths: staged ? [entry.path] : []
          },
          emphasis: delta?.objectsAdded.includes(entry.oid) ? "new" : delta?.indexChanged.includes(`${entry.path}:${entry.stage}`) ? "changed" : "default"
        });
        nodeIdsByOid.set(entry.oid, id);
        return;
      }

      existingNode.metadata.paths = ensureUniquePathList(existingNode.metadata.paths, entry.path);
      existingNode.metadata.indexEntry = true;
      if (staged) {
        existingNode.metadata.stagedPaths = ensureUniquePathList(existingNode.metadata.stagedPaths, entry.path);
        existingNode.metadata.staged = true;
      }
      existingNode.metadata.stagedOnly = false;
      existingNode.metadata.reused =
        (Array.isArray(existingNode.metadata.paths) ? existingNode.metadata.paths.length : 1) > 1;
      updateBlobNodePresentation(existingNode);
    });
  }

  resolveBlobCollisions(nodes);

  return { nodes, edges };
}

export function projectGraphIncremental(params: {
  snapshot: RepoStateSnapshot;
  selection?: GraphSelection | null;
  visibilityFilters?: GraphVisibilityFilters;
  expansionState?: GraphExpansionState;
  treeInspections?: Record<string, GitObjectInspection | undefined>;
  includeIndexBlobs?: boolean;
  delta?: StateDelta | null;
  cache?: GraphProjectionCache | null;
}): { graph: GraphViewModel; cache: GraphProjectionCache } {
  const snapshot = params.snapshot;
  const selection = params.selection ?? null;
  const visibilityFilters = params.visibilityFilters ?? createDefaultGraphVisibilityFilters();
  const expansionState = params.expansionState ?? createDefaultGraphExpansionState();
  const treeInspections = params.treeInspections ?? {};
  const includeIndexBlobs = params.includeIndexBlobs ?? true;
  const delta = params.delta ?? null;
  const signature = buildGraphProjectionSignature({
    snapshot,
    visibilityFilters,
    expansionState,
    treeInspections,
    includeIndexBlobs,
    delta
  });

  const structural = params.cache?.signature === signature
    ? { nodes: params.cache.nodes, edges: params.cache.edges }
    : buildGraphStructure({
        snapshot,
        visibilityFilters,
        expansionState,
        treeInspections,
        includeIndexBlobs,
        delta
      });

  return {
    graph: {
      nodes: structural.nodes,
      edges: structural.edges,
      workingArea: snapshot.workingTree.map((file) => ({
        id: `working:${file.path}`,
        path: file.path,
        indexStatus: file.indexStatus,
        workTreeStatus: file.workTreeStatus,
        emphasis: delta?.workingTreeChanged.includes(file.path) ? "changed" : "default"
      })),
      stagingArea: buildStagingArea(snapshot, delta),
      selection,
      visibilityFilters
    },
    cache: {
      signature,
      nodes: structural.nodes,
      edges: structural.edges
    }
  };
}

export function projectGraph(params: {
  snapshot: RepoStateSnapshot;
  selection?: GraphSelection | null;
  visibilityFilters?: GraphVisibilityFilters;
  expansionState?: GraphExpansionState;
  treeInspections?: Record<string, GitObjectInspection | undefined>;
  includeIndexBlobs?: boolean;
  delta?: StateDelta | null;
}): GraphViewModel {
  return projectGraphIncremental(params).graph;
}

function summarizeHistory(snapshot: RepoStateSnapshot): string[] {
  const summary = [`${snapshot.commitGraph.length} commits loaded`, `${snapshot.refs.length} refs visible`];
  if (snapshot.performance.commitGraphTruncated) {
    summary.push(`showing ${snapshot.performance.commitGraphRendered}/${snapshot.performance.commitGraphTotal} commits`);
  }
  return summary;
}

export function projectHistoryGraph(params: {
  snapshot: RepoStateSnapshot;
  selection?: GraphSelection | null;
  delta?: StateDelta | null;
}): HistoryGraphViewModel {
  const graph = projectGraph({
    snapshot: params.snapshot,
    selection: params.selection,
    visibilityFilters: {
      showRefs: true,
      showTrees: true,
      showBlobs: false,
      showTags: true
    },
    expansionState: createDefaultGraphExpansionState(),
    treeInspections: {},
    delta: params.delta ?? null
  });

  return {
    nodes: graph.nodes.filter((node) => node.type !== "blob"),
    edges: graph.edges.filter((edge) => {
      const source = graph.nodes.find((node) => node.id === edge.source);
      const target = graph.nodes.find((node) => node.id === edge.target);
      return source?.type !== "blob" && target?.type !== "blob";
    }),
    selection: graph.selection,
    summary: summarizeHistory(params.snapshot)
  };
}

export function projectChangePipeline(params: {
  snapshot: RepoStateSnapshot;
  workspace?: { files: Array<{ path: string; loaded?: boolean; size?: number }> } | null;
  delta?: StateDelta | null;
}): ChangePipelineViewModel {
  const { snapshot, delta = null } = params;
  const stagedBlobMap = new Map<string, ChangePipelineBlob>();

  snapshot.index.forEach((entry) => {
    const id = blobNodeId(entry.oid);
    const existing = stagedBlobMap.get(id);
    if (!existing) {
      stagedBlobMap.set(id, {
        id,
        oid: entry.oid,
        label: basename(entry.path),
        paths: [entry.path],
        reused: false,
        emphasis: delta?.objectsAdded.includes(entry.oid) ? "new" : delta?.indexChanged.includes(`${entry.path}:${entry.stage}`) ? "changed" : "default"
      });
      return;
    }

    existing.paths = ensureUniquePathList(existing.paths, entry.path);
    existing.reused = existing.paths.length > 1;
    existing.label = existing.reused ? `${basename(existing.paths[0])} +${existing.paths.length - 1}` : basename(existing.paths[0]);
  });

  const summary = [
    `${snapshot.workingTree.length} working tree changes`,
    `${snapshot.index.length} staged entries`,
    `${stagedBlobMap.size} staged blob objects`
  ];

  if (snapshot.performance.workingTreeTruncated) {
    summary.push(`showing ${snapshot.performance.workingTreeRendered}/${snapshot.performance.workingTreeTotal} working paths`);
  }
  if (snapshot.performance.indexTruncated) {
    summary.push(`showing ${snapshot.performance.indexRendered}/${snapshot.performance.indexTotal} staged entries`);
  }

  return {
    workingArea: snapshot.workingTree.map((file) => ({
      id: `working:${file.path}`,
      path: file.path,
      indexStatus: file.indexStatus,
      workTreeStatus: file.workTreeStatus,
      emphasis: delta?.workingTreeChanged.includes(file.path) ? "changed" : "default"
    })),
    stagingArea: buildStagingArea(snapshot, delta),
    stagedBlobs: Array.from(stagedBlobMap.values()),
    summary
  };
}

export function projectTreeExplorer(params: {
  selectedTreeOid: string | null;
  inspection?: GitObjectInspection | null;
}): TreeExplorerViewModel {
  const inspection = params.inspection;
  if (!params.selectedTreeOid || !inspection || inspection.type !== "tree") {
    return {
      rootOid: params.selectedTreeOid,
      title: "Tree Explorer",
      entries: [],
      graph: null,
      renderedEntries: 0,
      totalEntries: 0,
      truncated: false,
      summary: ["Select a tree or commit to inspect the committed directory snapshot."]
    };
  }

  const summary = [
    `${inspection.summary.renderedEntries} entries rendered`,
    `${inspection.summary.totalEntries} total entries`
  ];
  if (inspection.summary.truncated) {
    summary.push("Load more to inspect additional tree entries.");
  }

  const nodes: GraphViewModel["nodes"] = [
    {
      id: `tree:${inspection.oid}`,
      type: "tree",
      label: "ROOT TREE",
      oid: inspection.oid,
      target: null,
      position: { x: 90, y: 140 },
      metadata: {
        oid: inspection.oid,
        root: true
      }
    }
  ];
  const edges: GraphViewModel["edges"] = [];

  inspection.entries.forEach((entry, index) => {
    const isTree = entry.type === "tree";
    const id = `${entry.type}:${entry.oid}`;
    nodes.push({
      id,
      type: isTree ? "tree" : "blob",
      label: entry.path,
      oid: entry.oid,
      target: null,
      position: {
        x: isTree ? 380 : 670,
        y: 54 + index * 112
      },
      metadata: {
        oid: entry.oid,
        path: entry.path,
        mode: entry.mode,
        parentTreeOid: inspection.oid
      }
    });
    edges.push({
      id: `contains:tree:${inspection.oid}:${id}`,
      source: `tree:${inspection.oid}`,
      target: id,
      relationship: "contains"
    });
  });

  const graph: GraphViewModel = {
    nodes,
    edges,
    workingArea: [],
    stagingArea: [],
    selection: null,
    visibilityFilters: {
      showRefs: false,
      showTrees: true,
      showBlobs: true,
      showTags: false
    }
  };

  return {
    rootOid: inspection.oid,
    title: `Tree ${truncate(inspection.oid, 10)}`,
    entries: inspection.entries,
    graph,
    renderedEntries: inspection.summary.renderedEntries,
    totalEntries: inspection.summary.totalEntries,
    truncated: inspection.summary.truncated,
    summary
  };
}

function recommendation(category: CommandRecommendation["category"], command: string, description: string, affectedStructures: CommandRecommendation["affectedStructures"]): CommandRecommendation {
  const parsed = parseGitCommand(command);
  return {
    id: `${category}:${command}`,
    category,
    label: command,
    command,
    description,
    affectedStructures,
    risk: classifyRisk(parsed)
  };
}

export function recommendCommands(snapshot: RepoStateSnapshot): CommandRecommendation[] {
  const recommendations: CommandRecommendation[] = [];
  const remote = snapshot.remoteState;

  recommendations.push(
    recommendation("Daily Flow", "git status", "Check the current working tree and index state.", ["changes"]),
    recommendation("Investigation", "git log --graph --decorate --oneline --all -20", "Inspect recent branch and merge topology.", ["history"])
  );

  if (snapshot.workingTree.length > 0 && snapshot.index.length === 0) {
    recommendations.push(
      recommendation("Daily Flow", "git add .", "Stage the current working tree changes.", ["changes"]),
      recommendation("Daily Flow", "git restore --staged .", "Unstage changes if you staged too much.", ["changes"])
    );
  }

  if (snapshot.index.length > 0) {
    recommendations.push(
      recommendation("Daily Flow", "git commit -m \"Describe the change\"", "Turn staged state into a new commit.", ["changes", "history"])
    );
  }

  if (remote.divergence === "behind") {
    recommendations.push(
      recommendation("Integration", "git fetch --all --prune", "Update remote-tracking refs before integrating.", ["remote", "history"]),
      recommendation("Integration", "git pull --rebase", "Rebase local work on top of upstream.", ["remote", "history", "changes"])
    );
  } else if (remote.divergence === "ahead") {
    recommendations.push(recommendation("Integration", "git push", "Publish local commits to the upstream remote.", ["remote", "history"]));
  } else if (remote.divergence === "diverged") {
    recommendations.push(
      recommendation("Integration", "git fetch --all --prune", "Refresh remote-tracking refs before resolving divergence.", ["remote", "history"]),
      recommendation("Integration", "git rebase @{upstream}", "Reapply local commits on top of upstream when appropriate.", ["remote", "history", "changes"])
    );
  }

  if (snapshot.performance.isLargeRepo) {
    recommendations.push(
      recommendation("Large Repo / Maintenance", "git count-objects -v", "Inspect packfiles and loose-object pressure.", ["remote"]),
      recommendation("Large Repo / Maintenance", "git worktree list", "Inspect parallel working trees commonly used in large repos.", ["history"]),
      recommendation("Large Repo / Maintenance", "git gc", "Compact object storage when repository maintenance is needed.", ["remote"])
    );
  }

  return recommendations;
}

export function projectRemoteView(snapshot: RepoStateSnapshot, lastOperation: RemoteOperationSummary | null = null): RemoteViewModel {
  const remoteState = {
    ...snapshot.remoteState,
    lastOperation: lastOperation ?? snapshot.remoteState.lastOperation
  };
  const summary = [
    remoteState.currentBranchName ? `Current branch: ${remoteState.currentBranchName}` : "Detached HEAD or no current branch",
    remoteState.upstreamRefName ? `Upstream: ${remoteState.upstreamRefName}` : "No upstream configured",
    `Divergence: ${remoteState.divergence}`
  ];

  if (remoteState.upstreamRefName) {
    summary.push(`Ahead ${remoteState.ahead} / Behind ${remoteState.behind}`);
  }

  return {
    remotes: remoteState.remotes,
    remoteRefs: remoteState.remoteRefs,
    currentBranchName: remoteState.currentBranchName,
    currentBranchRef: remoteState.currentBranchRef,
    upstreamRefName: remoteState.upstreamRefName,
    divergence: remoteState.divergence,
    ahead: remoteState.ahead,
    behind: remoteState.behind,
    lastOperation: remoteState.lastOperation,
    recommendedCommands: recommendCommands(snapshot).filter((item) => item.affectedStructures.includes("remote")),
    summary
  };
}

export function createRepoInvalidation(params: { command?: string | null; changedPath?: string | null }): RepoInvalidation {
  const command = params.command?.trim() ?? null;
  const changedPath = params.changedPath ?? null;

  if (command) {
    const parsed = parseGitCommand(command);
    switch (parsed.subcommand) {
      case "add":
      case "restore":
      case "reset":
      case "stash":
        return { slices: ["changes", "timeline"], reason: parsed.subcommand, command };
      case "commit":
      case "switch":
      case "checkout":
      case "branch":
      case "merge":
      case "rebase":
      case "cherry-pick":
      case "revert":
        return { slices: ["history", "changes", "timeline", "remote"], reason: parsed.subcommand, command };
      case "fetch":
      case "pull":
      case "push":
      case "remote":
        return { slices: ["remote", "history", "timeline"], reason: parsed.subcommand, command };
      default:
        return { slices: ["history", "changes", "remote", "workspace", "timeline"], reason: parsed.subcommand, command };
    }
  }

  if (!changedPath) {
    return { slices: ["history", "changes", "remote", "workspace", "timeline"], reason: "unknown-watch" };
  }

  if (!changedPath.startsWith(".git/")) {
    return { slices: ["workspace", "changes"], reason: "workspace-change", changedPath };
  }

  if (changedPath === ".git/index") {
    return { slices: ["changes", "timeline"], reason: "index-change", changedPath };
  }

  if (changedPath === ".git/HEAD" || changedPath === ".git/packed-refs" || changedPath.startsWith(".git/refs/")) {
    return { slices: ["history", "remote", "timeline"], reason: "ref-change", changedPath };
  }

  if (changedPath === ".git/FETCH_HEAD") {
    return { slices: ["remote", "history", "timeline"], reason: "fetch-head", changedPath };
  }

  return { slices: ["history", "changes", "remote", "timeline"], reason: "git-metadata", changedPath };
}

export function createRepoReadOptions(invalidation: RepoInvalidation, current: RepoReadOptions = {}): RepoReadOptions {
  return {
    commitGraphLimit: current.commitGraphLimit ?? 24,
    workingTreeLimit: current.workingTreeLimit ?? 60,
    indexLimit: current.indexLimit ?? 60
  };
}

export function createWorkspaceReadOptions(current: WorkspaceReadOptions = {}): WorkspaceReadOptions {
  return {
    fileLimit: current.fileLimit ?? 60
  };
}

export function buildHistoryTimeline(snapshot: RepoStateSnapshot): TransitionJournal {
  const events: TimelineEvent[] = snapshot.commitGraph
    .slice()
    .reverse()
    .map((commit, index) => ({
      id: `history:${commit.oid}`,
      source: "history",
      kind: "commit",
      label: commit.subject || truncate(commit.oid, 10),
      command: null,
      explanation: [
        `Commit ${truncate(commit.oid, 10)} became part of the loaded history.`,
        `Tree ${truncate(commit.treeOid, 10)} captures the committed snapshot.`
      ],
      affectedStructures: ["history", "tree"],
      beforeRef: index > 0 ? snapshot.commitGraph.slice().reverse()[index - 1]?.oid ?? null : null,
      afterRef: commit.oid,
      beforeSnapshotRef: null,
      afterSnapshotRef: commit.oid,
      commitOid: commit.oid,
      transition: null
    }));

  return {
    events,
    hasMoreHistory: snapshot.performance.commitGraphTruncated,
    loadedHistoryCount: events.length
  };
}

export function appendSessionTransition(
  journal: TransitionJournal,
  transition: TimelineEvent
): TransitionJournal {
  return {
    ...journal,
    events: [...journal.events, transition]
  };
}

export function createTimelineEventFromTransition(transition: import("@git-observatory/core-domain").StateTransition): TimelineEvent {
  const affectedStructures: TimelineEvent["affectedStructures"] = [];
  if (transition.delta.refsChanged.length > 0 || transition.delta.headChanged) {
    affectedStructures.push("history");
  }
  if (transition.delta.indexChanged.length > 0 || transition.delta.workingTreeChanged.length > 0) {
    affectedStructures.push("changes");
  }
  if (transition.delta.remoteChanged.length > 0) {
    affectedStructures.push("remote");
  }
  if (transition.delta.objectsAdded.length > 0) {
    affectedStructures.push("tree");
  }

  return {
    id: `session:${transition.after.capturedAt}:${transition.command}`,
    source: "session",
    kind: "command",
    label: transition.command,
    command: transition.command,
    explanation: transition.explanation,
    affectedStructures,
    beforeRef: transition.before.head.oid,
    afterRef: transition.after.head.oid,
    beforeSnapshotRef: transition.before.capturedAt,
    afterSnapshotRef: transition.after.capturedAt,
    transition
  };
}

export function buildInspectorModel(params: {
  snapshot: RepoStateSnapshot;
  graph: GraphViewModel;
  selection: GraphSelection;
  inspectedObject?: GitObjectInspection | null;
  workspaceFiles?: Array<{ path: string; content?: string; status: string }>;
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
        rawLines: workspaceFile?.content ? workspaceFile.content.slice(0, 3000).split("\n") : []
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
    const blobPaths = Array.isArray(node.metadata.paths)
      ? node.metadata.paths.filter((item): item is string => typeof item === "string")
      : [];
    const blobPathSummary =
      blobPaths.length <= 1 ? (blobPaths[0] ?? node.label) : `${blobPaths[0]} (+${blobPaths.length - 1} more paths with identical content)`;

    return {
      title: node.label,
      kind: "blob object",
      summary:
        blobPaths.length > 1
          ? "A blob stores file content only. Multiple paths currently reuse this same saved content."
          : "A blob stores file content only, without the filename.",
      whatThisIs: "Blob objects are Git's raw content storage units.",
      underTheHood:
        "Git hashes the file contents, compresses them, and stores them as a blob. Trees and the index are what attach names and paths to blobs.",
      teaching: buildTeachingModel({ snapshot, kind: "blob", oid: node.oid }),
      fields: [
        { label: "OID", value: node.oid ?? "", monospace: true },
        { label: "Paths", value: blobPathSummary },
        { label: "Path count", value: String(blobPaths.length || 1) },
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
