import { contextBridge, ipcRenderer } from "electron";
import type { RepoReadOptions, RepoWatchEvent, SandboxKind, TreeReadOptions } from "@git-observatory/core-domain";

const repoWatchChannel = "observatory:repo-watch-event";

const api = {
  createSandbox: (kind: SandboxKind, name?: string) => ipcRenderer.invoke("observatory:create-sandbox", kind, name),
  inspectRepo: (repoPath: string) => ipcRenderer.invoke("observatory:inspect-repo", repoPath),
  inspectRepoWithOptions: (repoPath: string, options?: RepoReadOptions) =>
    ipcRenderer.invoke("observatory:inspect-repo-with-options", repoPath, options),
  inspectObject: (repoPath: string, oid: string) => ipcRenderer.invoke("observatory:inspect-object", repoPath, oid),
  inspectObjectWithOptions: (repoPath: string, oid: string, options?: TreeReadOptions) =>
    ipcRenderer.invoke("observatory:inspect-object-with-options", repoPath, oid, options),
  openSystemTerminal: (cwd: string) => ipcRenderer.invoke("observatory:open-system-terminal", cwd),
  startWatchingRepo: (repoPath: string) => ipcRenderer.invoke("observatory:start-watching-repo", repoPath),
  stopWatchingRepo: () => ipcRenderer.invoke("observatory:stop-watching-repo"),
  onRepoWatchEvent: (listener: (event: RepoWatchEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: RepoWatchEvent) => listener(payload);
    ipcRenderer.on(repoWatchChannel, handler);
    return () => {
      ipcRenderer.removeListener(repoWatchChannel, handler);
    };
  },
  removeSandbox: (repoPath: string) => ipcRenderer.invoke("observatory:remove-sandbox", repoPath)
};

contextBridge.exposeInMainWorld("gitObservatory", api);
