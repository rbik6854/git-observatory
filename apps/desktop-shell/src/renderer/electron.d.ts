import {
  GitObjectInspection,
  LessonChapter,
  LessonWorkspace,
  RepoWatchEvent,
  RepoStateSnapshot,
  SandboxCreationResult,
  SandboxKind,
  StateTransition,
  TerminalEvent,
  TerminalSessionDescriptor
} from "@git-observatory/core-domain";

declare global {
  interface Window {
    gitObservatory: {
      openRepo(): Promise<{ repoPath: string; snapshot: RepoStateSnapshot } | null>;
      createSandbox(kind: SandboxKind, name?: string): Promise<SandboxCreationResult>;
      inspectRepo(repoPath: string): Promise<RepoStateSnapshot>;
      inspectObject(repoPath: string, oid: string): Promise<GitObjectInspection | null>;
      runGitCommand(repoPath: string, command: string): Promise<StateTransition>;
      createTerminal(cwd: string): Promise<TerminalSessionDescriptor>;
      writeTerminal(sessionId: string, data: string): Promise<void>;
      resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void>;
      closeTerminal(sessionId: string): Promise<void>;
      readTerminalBuffer(sessionId: string): Promise<string>;
      startWatchingRepo(repoPath: string): Promise<void>;
      stopWatchingRepo(): Promise<void>;
      onTerminalEvent(listener: (event: TerminalEvent) => void): () => void;
      onRepoWatchEvent(listener: (event: RepoWatchEvent) => void): () => void;
      listLessons(): Promise<LessonChapter[]>;
      readWorkspace(repoPath: string): Promise<LessonWorkspace>;
      createWorkspaceFile(repoPath: string, filePath: string, content: string): Promise<LessonWorkspace>;
      updateWorkspaceFile(repoPath: string, filePath: string, content: string): Promise<LessonWorkspace>;
      deleteWorkspaceFile(repoPath: string, filePath: string): Promise<LessonWorkspace>;
    };
  }
}

export {};
