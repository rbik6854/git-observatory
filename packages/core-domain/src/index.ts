export type RiskClassification = "safe" | "mutating" | "destructive";

export type GitObjectType = "blob" | "tree" | "commit" | "tag" | "unknown";
export type GitObjectStorage = "loose" | "packed" | "unknown";
export type RefScope = "local" | "remote" | "tag" | "special";
export type GitDirectoryEntryKind = "file" | "directory";
export type VisualizationFocus =
  | "state-map"
  | "working-tree"
  | "index"
  | "objects"
  | "refs"
  | "head"
  | "operations"
  | "git-directory"
  | "remotes"
  | "packfiles"
  | "graph";

export type DetailPanelId =
  | "working-tree"
  | "index"
  | "objects"
  | "refs"
  | "git-directory"
  | "stdout"
  | "stderr"
  | "graph"
  | "glossary";

export type VisualizationSceneType =
  | "repo-birth"
  | "workspace-status"
  | "add-pipeline"
  | "commit-constructor"
  | "refs-head"
  | "operation-overlay"
  | "advanced-observatory";

export type LessonSetupState =
  | "empty-directory"
  | "git-initialized"
  | "workspace-file-created"
  | "readme-staged"
  | "initial-commit-created"
  | "branch-created"
  | "history-diverged"
  | "remote-configured"
  | "recovery-ready"
  | "packfile-ready";

export type LessonValidationRule =
  | "git-init"
  | "workspace-file-exists"
  | "git-add-readme"
  | "git-commit-initial"
  | "head-moved"
  | "manual-review";

export type GuidedActionKind = "git-command" | "workspace-file-create" | "workspace-file-edit" | "info";
export type LessonChapterStatus = "interactive" | "planned";
export type LessonWorkspaceFileStatus = "untracked" | "tracked" | "staged" | "committed";
export type SandboxKind = "learning" | "practice";

export interface ParsedGitCommand {
  raw: string;
  binary: "git";
  subcommand: string;
  args: string[];
  flags: string[];
  nouns: string[];
}

export interface WorkingTreeFile {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
}

export interface IndexEntry {
  mode: string;
  oid: string;
  stage: number;
  path: string;
}

export interface RefSummary {
  name: string;
  oid: string;
  objectType: GitObjectType;
  scope: RefScope;
}

export interface HeadSummary {
  detached: boolean;
  target: string | null;
  oid: string | null;
}

export interface GitObjectSummary {
  oid: string;
  type: GitObjectType;
  size: number;
  storage: GitObjectStorage;
}

export interface CommitGraphNode {
  oid: string;
  treeOid: string;
  parents: string[];
  subject: string;
  decorations: string[];
}

export interface GitDirectoryEntry {
  path: string;
  kind: GitDirectoryEntryKind;
  preview?: string;
}

export interface OperationStateSummary {
  mergeInProgress: boolean;
  rebaseInProgress: boolean;
  cherryPickInProgress: boolean;
  revertInProgress: boolean;
  bisectInProgress: boolean;
  stashCount: number;
}

export interface RemoteSummary {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
}

export interface PackfileSummary {
  count: number;
  sizeKiB: number;
  inPack: number;
  packs: number;
  sizePackKiB: number;
  prunePackable: number;
  garbage: number;
  sizeGarbageKiB: number;
}

export interface RepoStateSnapshot {
  repoPath: string;
  capturedAt: string;
  gitDir: string | null;
  workingTree: WorkingTreeFile[];
  index: IndexEntry[];
  refs: RefSummary[];
  head: HeadSummary;
  objects: GitObjectSummary[];
  commitGraph: CommitGraphNode[];
  gitDirectory: GitDirectoryEntry[];
  operations: OperationStateSummary;
  remotes: RemoteSummary[];
  packfiles: PackfileSummary;
  notes: string[];
}

export type GraphNodeType = "head" | "ref" | "commit" | "tree" | "blob";
export type GraphEdgeRelationship = "points-to" | "parent" | "contains" | "symbolic";
export type InspectorTab = "what" | "internals" | "mapping" | "raw";
export type GraphSelection =
  | { kind: "node"; id: string }
  | { kind: "working-tree"; path: string }
  | { kind: "staging"; path: string; stage: number }
  | { kind: "composer" };

export interface GraphPosition {
  x: number;
  y: number;
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  oid: string | null;
  target: string | null;
  position: GraphPosition;
  metadata: Record<string, string | number | boolean | string[] | null>;
  emphasis?: "default" | "new" | "changed";
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: GraphEdgeRelationship;
  emphasis?: "default" | "new" | "changed";
}

export interface WorkingAreaItem {
  id: string;
  path: string;
  indexStatus: string;
  workTreeStatus: string;
}

export interface StagingAreaItem {
  id: string;
  path: string;
  oid: string;
  mode: string;
  stage: number;
}

export interface GraphVisibilityFilters {
  showRefs: boolean;
  showTrees: boolean;
  showBlobs: boolean;
  showTags: boolean;
}

export interface GraphViewModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  workingArea: WorkingAreaItem[];
  stagingArea: StagingAreaItem[];
  selection: GraphSelection | null;
  visibilityFilters: GraphVisibilityFilters;
}

export interface GraphExpansionState {
  expandedTreeOids: string[];
}

export interface InspectorField {
  label: string;
  value: string;
  monospace?: boolean;
}

export interface InspectorTeachingCommand {
  label: string;
  command: string;
  description: string;
}

export interface InspectorTeachingModel {
  represents: string;
  locations: string[];
  commands: InspectorTeachingCommand[];
  notes: string[];
}

export interface InspectorModel {
  title: string;
  kind: string;
  summary: string;
  whatThisIs: string;
  underTheHood: string;
  teaching: InspectorTeachingModel;
  fields: InspectorField[];
  rawLines: string[];
}

export interface TerminalLogEntry {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: string;
}

export interface TerminalSessionModel {
  currentInput: string;
  history: string[];
  entries: TerminalLogEntry[];
  activeRepoPath: string | null;
  pending: boolean;
}

export interface TerminalSessionDescriptor {
  id: string;
  cwd: string;
  shell: string;
  collapsed: boolean;
  height: number;
}

export type TerminalEvent =
  | { type: "ready"; sessionId: string }
  | { type: "output"; sessionId: string; data: string }
  | { type: "exit"; sessionId: string; exitCode: number }
  | { type: "cwd-change"; sessionId: string; cwd: string }
  | { type: "error"; sessionId: string; message: string };

export interface RepoWatchEvent {
  repoPath: string;
  changedPath: string | null;
  timestamp: string;
}

export interface GitTreeEntryDetail {
  mode: string;
  type: GitObjectType;
  oid: string;
  path: string;
}

export type GitObjectInspection =
  | {
      type: "blob";
      oid: string;
      size: number;
      storage: GitObjectStorage;
      preview: string;
    }
  | {
      type: "tree";
      oid: string;
      size: number;
      storage: GitObjectStorage;
      entries: GitTreeEntryDetail[];
    }
  | {
      type: "commit";
      oid: string;
      size: number;
      storage: GitObjectStorage;
      treeOid: string | null;
      parents: string[];
      subject: string;
      body: string;
      author: string;
      committer: string;
    }
  | {
      type: "tag";
      oid: string;
      size: number;
      storage: GitObjectStorage;
      target: string | null;
      tagName: string | null;
      message: string;
    }
  | {
      type: "unknown";
      oid: string;
      size: number;
      storage: GitObjectStorage;
      raw: string;
    };

export interface RefDelta {
  name: string;
  beforeOid: string | null;
  afterOid: string | null;
}

export interface StateDelta {
  workingTreeChanged: string[];
  indexChanged: string[];
  objectsAdded: string[];
  refsChanged: RefDelta[];
  headChanged: boolean;
  operationsChanged: boolean;
  gitDirectoryChanged: string[];
  remoteChanged: string[];
  packfilesChanged: boolean;
}

export interface RecoveryCheckpoint {
  id: string;
  createdAt: string;
  repoPath: string;
  headOid: string | null;
  headTarget: string | null;
  dirty: boolean;
  reflogHint: string;
}

export interface StateTransition {
  command: string;
  parsedCommand: ParsedGitCommand;
  risk: RiskClassification;
  before: RepoStateSnapshot;
  after: RepoStateSnapshot;
  delta: StateDelta;
  explanation: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
  checkpoint?: RecoveryCheckpoint;
}

export interface VisualizationCallout {
  id: string;
  title: string;
  description: string;
  target: string;
}

export interface VisualizationScene {
  id: string;
  title: string;
  type: VisualizationSceneType;
  summary: string;
  emphasizedStructures: VisualizationFocus[];
  glossaryTerms: string[];
  callouts: VisualizationCallout[];
}

export interface LessonFileTemplate {
  path: string;
  content: string;
  description?: string;
}

export interface LessonStep {
  id: string;
  title: string;
  prompt: string;
  guidedActionLabel: string;
  guidedActionKind: GuidedActionKind;
  suggestedCommand?: string;
  requiredFiles: LessonFileTemplate[];
  setupState: LessonSetupState;
  validationRule: LessonValidationRule;
  primaryScene: VisualizationScene;
  detailPanels: DetailPanelId[];
  plainEnglishExplanation: string;
  deepDiveExplanation: string;
}

export interface LessonChapter {
  id: string;
  title: string;
  summary: string;
  status: LessonChapterStatus;
  outcomes: string[];
  learningSections: string[];
  steps: LessonStep[];
}

export interface LessonWorkspaceFile {
  path: string;
  content: string;
  status: LessonWorkspaceFileStatus;
}

export interface LessonWorkspace {
  repoPath: string;
  files: LessonWorkspaceFile[];
  selectedPath: string | null;
  terminalUnlocked: boolean;
  modifiedAt: string;
}

export interface SandboxDescriptor {
  repoPath: string;
  kind: SandboxKind;
  createdAt: string;
  sessionId: string;
}

export interface SandboxCreationResult {
  repoPath: string;
  snapshot: RepoStateSnapshot;
  sandbox: SandboxDescriptor;
}

export interface GitExecutionAdapter {
  inspectRepo(repoPath: string): Promise<RepoStateSnapshot>;
  executeCommand(repoPath: string, command: string): Promise<StateTransition>;
  createCheckpoint(repoPath: string): Promise<RecoveryCheckpoint>;
  createSandbox(kind: SandboxKind, rootPath: string, sessionId: string, name?: string): Promise<SandboxCreationResult>;
  inspectObject(repoPath: string, oid: string): Promise<GitObjectInspection | null>;
}

export interface WorkspaceAdapter {
  readWorkspace(repoPath: string): Promise<LessonWorkspace>;
  createFile(repoPath: string, filePath: string, content: string): Promise<LessonWorkspace>;
  updateFile(repoPath: string, filePath: string, content: string): Promise<LessonWorkspace>;
  deleteFile(repoPath: string, filePath: string): Promise<LessonWorkspace>;
}

export interface SandboxManager {
  createSandbox(kind: SandboxKind, name?: string): Promise<SandboxCreationResult>;
  registerSandbox(sandbox: SandboxDescriptor): void;
  listSessionSandboxes(): SandboxDescriptor[];
  cleanupSessionSandboxes(): Promise<void>;
  cleanupStaleSandboxes(): Promise<void>;
}

const SAFE_COMMANDS = new Set([
  "status",
  "log",
  "show",
  "diff",
  "rev-parse",
  "cat-file",
  "ls-files",
  "for-each-ref",
  "branch"
]);

const MUTATING_COMMANDS = new Set([
  "init",
  "add",
  "commit",
  "restore",
  "reset",
  "switch",
  "checkout",
  "merge",
  "rebase",
  "cherry-pick",
  "revert",
  "stash",
  "fetch",
  "pull",
  "push",
  "remote",
  "tag",
  "worktree",
  "bisect",
  "gc",
  "config"
]);

const DESTRUCTIVE_FLAGS = new Set(["--hard", "--force", "-f", "-D"]);

function tokenize(command: string): string[] {
  const matches = command.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\S+/g);
  return (matches ?? []).map((token) => token.replace(/^['"]|['"]$/g, ""));
}

export function parseGitCommand(raw: string): ParsedGitCommand {
  const tokens = tokenize(raw.trim());
  const gitTokens = tokens[0] === "git" ? tokens.slice(1) : tokens;
  const [subcommand = "status", ...args] = gitTokens;
  const flags = args.filter((arg) => arg.startsWith("-"));
  const nouns = args.filter((arg) => !arg.startsWith("-"));

  return {
    raw,
    binary: "git",
    subcommand,
    args,
    flags,
    nouns
  };
}

export function classifyRisk(command: ParsedGitCommand): RiskClassification {
  if (command.flags.some((flag) => DESTRUCTIVE_FLAGS.has(flag))) {
    return "destructive";
  }

  if (command.subcommand === "reset" && command.args.includes("--hard")) {
    return "destructive";
  }

  if (command.subcommand === "clean") {
    return "destructive";
  }

  if (SAFE_COMMANDS.has(command.subcommand)) {
    return "safe";
  }

  if (MUTATING_COMMANDS.has(command.subcommand)) {
    return "mutating";
  }

  return "mutating";
}

export function createEmptySnapshot(repoPath: string, notes: string[] = []): RepoStateSnapshot {
  return {
    repoPath,
    capturedAt: new Date().toISOString(),
    gitDir: null,
    workingTree: [],
    index: [],
    refs: [],
    head: {
      detached: false,
      target: null,
      oid: null
    },
    objects: [],
    commitGraph: [],
    gitDirectory: [],
    operations: {
      mergeInProgress: false,
      rebaseInProgress: false,
      cherryPickInProgress: false,
      revertInProgress: false,
      bisectInProgress: false,
      stashCount: 0
    },
    remotes: [],
    packfiles: {
      count: 0,
      sizeKiB: 0,
      inPack: 0,
      packs: 0,
      sizePackKiB: 0,
      prunePackable: 0,
      garbage: 0,
      sizeGarbageKiB: 0
    },
    notes
  };
}

export function createEmptyWorkspace(repoPath: string): LessonWorkspace {
  return {
    repoPath,
    files: [],
    selectedPath: null,
    terminalUnlocked: false,
    modifiedAt: new Date().toISOString()
  };
}
