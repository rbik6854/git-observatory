import {
  GitObjectInspection,
  RepoReadOptions,
  RepoWatchEvent,
  RepoStateSnapshot,
  SandboxCreationResult,
  SandboxKind,
  TreeReadOptions
} from "@git-observatory/core-domain";

declare global {
  interface Window {
    gitObservatory: {
      createSandbox(kind: SandboxKind, name?: string): Promise<SandboxCreationResult>;
      inspectRepo(repoPath: string): Promise<RepoStateSnapshot>;
      inspectRepoWithOptions(repoPath: string, options?: RepoReadOptions): Promise<RepoStateSnapshot>;
      inspectObject(repoPath: string, oid: string): Promise<GitObjectInspection | null>;
      inspectObjectWithOptions(repoPath: string, oid: string, options?: TreeReadOptions): Promise<GitObjectInspection | null>;
      openSystemTerminal(cwd: string): Promise<void>;
      startWatchingRepo(repoPath: string): Promise<void>;
      stopWatchingRepo(): Promise<void>;
      onRepoWatchEvent(listener: (event: RepoWatchEvent) => void): () => void;
      removeSandbox(repoPath: string): Promise<void>;
    };
  }
}

export {};
