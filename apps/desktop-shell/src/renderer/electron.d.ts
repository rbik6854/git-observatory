import {
  GitObjectInspection,
  LessonChapter,
  LessonWorkspace,
  RemoteInspectResult,
  RepoReadOptions,
  RepoWatchEvent,
  RepoStateSnapshot,
  SandboxCreationResult,
  SandboxKind,
  StateTransition,
  TerminalEvent,
  TerminalSessionDescriptor,
  TreeReadOptions,
  WorkspaceReadOptions
} from "@git-observatory/core-domain";

declare global {
  interface Window {
    gitObservatory: {
      openRepo(): Promise<{ repoPath: string; snapshot: RepoStateSnapshot } | null>;
      createSandbox(kind: SandboxKind, name?: string): Promise<SandboxCreationResult>;
      inspectRepo(repoPath: string): Promise<RepoStateSnapshot>;
      inspectRepoWithOptions(repoPath: string, options?: RepoReadOptions): Promise<RepoStateSnapshot>;
      inspectObject(repoPath: string, oid: string): Promise<GitObjectInspection | null>;
      inspectObjectWithOptions(repoPath: string, oid: string, options?: TreeReadOptions): Promise<GitObjectInspection | null>;
      inspectRemote(repoPath: string, remoteName: string): Promise<RemoteInspectResult>;
      runGitCommand(repoPath: string, command: string): Promise<StateTransition>;
      createTerminal(cwd: string): Promise<TerminalSessionDescriptor>;
      writeTerminal(sessionId: string, data: string): Promise<void>;
      resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void>;
      closeTerminal(sessionId: string): Promise<void>;
      readTerminalBuffer(sessionId: string): Promise<string>;
      openSystemTerminal(cwd: string): Promise<void>;
      startWatchingRepo(repoPath: string): Promise<void>;
      stopWatchingRepo(): Promise<void>;
      onTerminalEvent(listener: (event: TerminalEvent) => void): () => void;
      onRepoWatchEvent(listener: (event: RepoWatchEvent) => void): () => void;
      listLessons(): Promise<LessonChapter[]>;
      readWorkspace(repoPath: string): Promise<LessonWorkspace>;
      readWorkspaceWithOptions(repoPath: string, options?: WorkspaceReadOptions): Promise<LessonWorkspace>;
      readWorkspaceFile(repoPath: string, filePath: string): Promise<LessonWorkspace["files"][number] | null>;
      createWorkspaceFile(repoPath: string, filePath: string, content: string): Promise<LessonWorkspace>;
      updateWorkspaceFile(repoPath: string, filePath: string, content: string): Promise<LessonWorkspace>;
      deleteWorkspaceFile(repoPath: string, filePath: string): Promise<LessonWorkspace>;
      removeSandbox(repoPath: string): Promise<void>;
    };
  }
}

export {};
