import { contextBridge, ipcRenderer } from "electron";
import type { RemoteInspectResult, RepoReadOptions, RepoWatchEvent, SandboxKind, TerminalEvent, TreeReadOptions, WorkspaceReadOptions } from "@git-observatory/core-domain";

const terminalChannel = "observatory:terminal-event";
const repoWatchChannel = "observatory:repo-watch-event";

const api = {
  openRepo: () => ipcRenderer.invoke("observatory:open-repo"),
  createSandbox: (kind: SandboxKind, name?: string) => ipcRenderer.invoke("observatory:create-sandbox", kind, name),
  inspectRepo: (repoPath: string) => ipcRenderer.invoke("observatory:inspect-repo", repoPath),
  inspectRepoWithOptions: (repoPath: string, options?: RepoReadOptions) =>
    ipcRenderer.invoke("observatory:inspect-repo-with-options", repoPath, options),
  inspectObject: (repoPath: string, oid: string) => ipcRenderer.invoke("observatory:inspect-object", repoPath, oid),
  inspectObjectWithOptions: (repoPath: string, oid: string, options?: TreeReadOptions) =>
    ipcRenderer.invoke("observatory:inspect-object-with-options", repoPath, oid, options),
  inspectRemote: (repoPath: string, remoteName: string): Promise<RemoteInspectResult> =>
    ipcRenderer.invoke("observatory:inspect-remote", repoPath, remoteName),
  runGitCommand: (repoPath: string, command: string) =>
    ipcRenderer.invoke("observatory:run-command", repoPath, command),
  createTerminal: (cwd: string) => ipcRenderer.invoke("observatory:create-terminal", cwd),
  writeTerminal: (sessionId: string, data: string) => ipcRenderer.invoke("observatory:write-terminal", sessionId, data),
  resizeTerminal: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke("observatory:resize-terminal", sessionId, cols, rows),
  closeTerminal: (sessionId: string) => ipcRenderer.invoke("observatory:close-terminal", sessionId),
  readTerminalBuffer: (sessionId: string) => ipcRenderer.invoke("observatory:read-terminal-buffer", sessionId),
  openSystemTerminal: (cwd: string) => ipcRenderer.invoke("observatory:open-system-terminal", cwd),
  startWatchingRepo: (repoPath: string) => ipcRenderer.invoke("observatory:start-watching-repo", repoPath),
  stopWatchingRepo: () => ipcRenderer.invoke("observatory:stop-watching-repo"),
  onTerminalEvent: (listener: (event: TerminalEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: TerminalEvent) => listener(payload);
    ipcRenderer.on(terminalChannel, handler);
    return () => {
      ipcRenderer.removeListener(terminalChannel, handler);
    };
  },
  onRepoWatchEvent: (listener: (event: RepoWatchEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: RepoWatchEvent) => listener(payload);
    ipcRenderer.on(repoWatchChannel, handler);
    return () => {
      ipcRenderer.removeListener(repoWatchChannel, handler);
    };
  },
  listLessons: () => ipcRenderer.invoke("observatory:list-lessons"),
  readWorkspace: (repoPath: string) => ipcRenderer.invoke("observatory:read-workspace", repoPath),
  readWorkspaceWithOptions: (repoPath: string, options?: WorkspaceReadOptions) =>
    ipcRenderer.invoke("observatory:read-workspace-with-options", repoPath, options),
  readWorkspaceFile: (repoPath: string, filePath: string) => ipcRenderer.invoke("observatory:read-workspace-file", repoPath, filePath),
  createWorkspaceFile: (repoPath: string, filePath: string, content: string) =>
    ipcRenderer.invoke("observatory:create-workspace-file", repoPath, filePath, content),
  updateWorkspaceFile: (repoPath: string, filePath: string, content: string) =>
    ipcRenderer.invoke("observatory:update-workspace-file", repoPath, filePath, content),
  deleteWorkspaceFile: (repoPath: string, filePath: string) =>
    ipcRenderer.invoke("observatory:delete-workspace-file", repoPath, filePath),
  removeSandbox: (repoPath: string) => ipcRenderer.invoke("observatory:remove-sandbox", repoPath)
};

contextBridge.exposeInMainWorld("gitObservatory", api);
