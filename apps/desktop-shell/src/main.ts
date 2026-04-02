import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import chokidar, { type FSWatcher } from "chokidar";
import * as nodePty from "node-pty";
import type { IPty } from "node-pty";
import {
  RepoWatchEvent,
  SandboxCreationResult,
  SandboxDescriptor,
  SandboxKind,
  SandboxManager,
  TerminalEvent,
  TerminalSessionDescriptor
} from "@git-observatory/core-domain";
import { lessonChapters } from "@git-observatory/core-lessons";
import { LocalGitExecutionAdapter, LocalWorkspaceAdapter } from "@git-observatory/desktop-git-adapter";

const gitAdapter = new LocalGitExecutionAdapter();
const workspaceAdapter = new LocalWorkspaceAdapter();
const sessionId = `${Date.now()}`;
const sandboxRoot = path.join(os.tmpdir(), "git-observatory");
const terminalChannel = "observatory:terminal-event";
const repoWatchChannel = "observatory:repo-watch-event";

class ElectronSandboxManager implements SandboxManager {
  private readonly sandboxes = new Map<string, SandboxDescriptor>();

  constructor(
    private readonly rootPath: string,
    private readonly session: string
  ) {}

  registerSandbox(sandbox: SandboxDescriptor): void {
    this.sandboxes.set(sandbox.repoPath, sandbox);
  }

  listSessionSandboxes(): SandboxDescriptor[] {
    return Array.from(this.sandboxes.values());
  }

  async createSandbox(kind: SandboxKind, name?: string): Promise<SandboxCreationResult> {
    const sessionRoot = path.join(this.rootPath, this.session);
    const result = await gitAdapter.createSandbox(kind, sessionRoot, this.session, name);
    this.registerSandbox(result.sandbox);
    return result;
  }

  async cleanupSessionSandboxes(): Promise<void> {
    const sandboxes = this.listSessionSandboxes();
    await Promise.all(
      sandboxes.map(async (sandbox) => {
        try {
          await removeDirectoryBestEffort(sandbox.repoPath);
        } catch (error) {
          console.error(`Failed to remove sandbox ${sandbox.repoPath}`, error);
        } finally {
          this.sandboxes.delete(sandbox.repoPath);
        }
      })
    );

    try {
      await removeDirectoryBestEffort(path.join(this.rootPath, this.session));
    } catch (error) {
      console.error(`Failed to remove sandbox session root ${this.session}`, error);
    }
  }

  async cleanupStaleSandboxes(): Promise<void> {
    await fs.mkdir(this.rootPath, { recursive: true });
    const entries = await fs.readdir(this.rootPath, { withFileTypes: true });

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name !== this.session)
        .map(async (entry) => {
          const target = path.join(this.rootPath, entry.name);
          try {
            await removeDirectoryBestEffort(target);
          } catch (error) {
            const code = (error as NodeJS.ErrnoException | undefined)?.code;
            if (code === "EBUSY" || code === "EPERM") {
              console.warn(`Skipping stale sandbox cleanup for locked path ${target}`);
              return;
            }
            console.error(`Failed to remove stale sandbox root ${target}`, error);
          }
        })
    );
  }
}

const sandboxManager = new ElectronSandboxManager(sandboxRoot, sessionId);
let cleaningUp = false;
let cleanupRequested = false;
let mainWindow: BrowserWindow | null = null;
const activeRepoWatchers: FSWatcher[] = [];
let activeRepoWatchedPath: string | null = null;
let repoWatchEmitTimeout: NodeJS.Timeout | null = null;

function normalizeWatchedPath(repoPath: string, changedAbsolutePath: string | null): string | null {
  if (!changedAbsolutePath) {
    return null;
  }

  return path.relative(repoPath, changedAbsolutePath).replace(/\\/g, "/");
}

function gitWatchTargets(repoPath: string): string[] {
  const gitDir = path.join(repoPath, ".git");
  return [
    path.join(gitDir, "HEAD"),
    path.join(gitDir, "index"),
    path.join(gitDir, "packed-refs"),
    path.join(gitDir, "FETCH_HEAD"),
    path.join(gitDir, "ORIG_HEAD"),
    path.join(gitDir, "MERGE_HEAD"),
    path.join(gitDir, "REBASE_HEAD"),
    path.join(gitDir, "CHERRY_PICK_HEAD"),
    path.join(gitDir, "REVERT_HEAD"),
    path.join(gitDir, "BISECT_LOG"),
    path.join(gitDir, "refs"),
    path.join(gitDir, "rebase-apply"),
    path.join(gitDir, "rebase-merge")
  ];
}

async function removeDirectoryBestEffort(targetPath: string): Promise<void> {
  const delays = [0, 150, 400];

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    try {
      if (delays[attempt] > 0) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      const lastAttempt = attempt === delays.length - 1;
      if ((code === "EBUSY" || code === "EPERM") && !lastAttempt) {
        continue;
      }
      throw error;
    }
  }
}

class TerminalManager {
  private readonly sessions = new Map<string, { descriptor: TerminalSessionDescriptor; pty: IPty; buffer: string }>();

  constructor(private readonly emitEvent: (event: TerminalEvent) => void) {}

  createTerminal(cwd: string): TerminalSessionDescriptor {
    const shell = process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "bash";
    const args = process.platform === "win32" ? ["-NoLogo"] : [];
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const descriptor: TerminalSessionDescriptor = {
      id,
      cwd,
      shell,
      collapsed: false,
      height: 320
    };

    const terminal = nodePty.spawn(shell, args, {
      name: "xterm-color",
      cols: 120,
      rows: 20,
      cwd,
      env: process.env as Record<string, string>
    });

    terminal.onData((data) => {
      const current = this.sessions.get(id);
      if (current) {
        current.buffer = `${current.buffer}${data}`.slice(-20000);
      }
      this.emitEvent({ type: "output", sessionId: id, data });
    });

    terminal.onExit(({ exitCode }) => {
      this.emitEvent({ type: "exit", sessionId: id, exitCode });
      this.sessions.delete(id);
    });

    this.sessions.set(id, { descriptor, pty: terminal, buffer: "" });
    setTimeout(() => {
      this.emitEvent({ type: "ready", sessionId: id });
      this.emitEvent({ type: "cwd-change", sessionId: id, cwd });
    }, 0);
    return descriptor;
  }

  writeTerminal(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.emitEvent({ type: "error", sessionId, message: "Terminal session not found." });
      return;
    }

    session.pty.write(data);
  }

  resizeTerminal(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.pty.resize(Math.max(10, cols), Math.max(5, rows));
  }

  closeTerminal(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.pty.kill();
    this.sessions.delete(sessionId);
  }

  closeAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.closeTerminal(sessionId);
    }
  }

  readBuffer(sessionId: string): string {
    return this.sessions.get(sessionId)?.buffer ?? "";
  }
}

const terminalManager = new TerminalManager((event) => {
  mainWindow?.webContents.send(terminalChannel, event);
});

function emitRepoWatchEvent(event: RepoWatchEvent): void {
  mainWindow?.webContents.send(repoWatchChannel, event);
}

function stopWatchingRepo(): void {
  if (repoWatchEmitTimeout) {
    clearTimeout(repoWatchEmitTimeout);
    repoWatchEmitTimeout = null;
  }

  while (activeRepoWatchers.length > 0) {
    const watcher = activeRepoWatchers.pop();
    watcher?.close().catch((error) => {
      console.error("Failed to close repo watcher", error);
    });
  }

  activeRepoWatchedPath = null;
}

function startWatchingRepo(repoPath: string): void {
  if (activeRepoWatchedPath === repoPath && activeRepoWatchers.length > 0) {
    return;
  }

  stopWatchingRepo();
  activeRepoWatchedPath = repoPath;

  const emitChanged = (changedAbsolutePath: string | null) => {
    const changedPath = normalizeWatchedPath(repoPath, changedAbsolutePath);
    if (!changedPath || changedPath === ".git/index.lock" || changedPath === ".git/COMMIT_EDITMSG") {
      return;
    }

    if (repoWatchEmitTimeout) {
      clearTimeout(repoWatchEmitTimeout);
    }

    repoWatchEmitTimeout = setTimeout(() => {
      emitRepoWatchEvent({
        repoPath,
        changedPath,
        timestamp: new Date().toISOString()
      });
    }, 350);
  };

  try {
    const workingTreeWatcher = chokidar.watch(repoPath, {
      ignored: [
        /(^|[\\/])\.git([\\/]|$)/,
        /(^|[\\/])node_modules([\\/]|$)/
      ],
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 180,
        pollInterval: 50
      }
    });

    const metadataWatcher = chokidar.watch(gitWatchTargets(repoPath), {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 180,
        pollInterval: 50
      }
    });

    [workingTreeWatcher, metadataWatcher].forEach((watcher) => {
      watcher
        .on("add", (changedPath) => emitChanged(changedPath))
        .on("change", (changedPath) => emitChanged(changedPath))
        .on("unlink", (changedPath) => emitChanged(changedPath))
        .on("addDir", (changedPath) => emitChanged(changedPath))
        .on("unlinkDir", (changedPath) => emitChanged(changedPath))
        .on("error", (error) => {
          console.error(`Repo watch error for ${repoPath}`, error);
        });
      activeRepoWatchers.push(watcher);
    });
  } catch (error) {
    console.error(`Failed to start repo watch for ${repoPath}`, error);
  }
}

async function cleanupAndQuitIfNeeded(): Promise<void> {
  if (cleaningUp) {
    return;
  }
  cleaningUp = true;
  stopWatchingRepo();
  terminalManager.closeAll();
  await sandboxManager.cleanupSessionSandboxes();
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0f1720",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  void window.loadFile(path.join(__dirname, "../dist/renderer/index.html"));
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  return window;
}

ipcMain.handle("observatory:open-repo", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const repoPath = result.filePaths[0];
  const snapshot = await gitAdapter.inspectRepo(repoPath);
  startWatchingRepo(repoPath);
  return { repoPath, snapshot };
});

ipcMain.handle("observatory:create-sandbox", async (_event, kind: SandboxKind, name?: string) => {
  const result = await sandboxManager.createSandbox(kind, name);
  startWatchingRepo(result.repoPath);
  return result;
});

ipcMain.handle("observatory:inspect-repo", async (_event, repoPath: string) => {
  return gitAdapter.inspectRepo(repoPath);
});

ipcMain.handle("observatory:inspect-object", async (_event, repoPath: string, oid: string) => {
  return gitAdapter.inspectObject(repoPath, oid);
});

ipcMain.handle("observatory:run-command", async (_event, repoPath: string, command: string) => {
  return gitAdapter.executeCommand(repoPath, command);
});

ipcMain.handle("observatory:create-terminal", async (_event, cwd: string) => {
  return terminalManager.createTerminal(cwd);
});

ipcMain.handle("observatory:write-terminal", async (_event, sessionId: string, data: string) => {
  terminalManager.writeTerminal(sessionId, data);
});

ipcMain.handle("observatory:resize-terminal", async (_event, sessionId: string, cols: number, rows: number) => {
  terminalManager.resizeTerminal(sessionId, cols, rows);
});

ipcMain.handle("observatory:close-terminal", async (_event, sessionId: string) => {
  terminalManager.closeTerminal(sessionId);
});

ipcMain.handle("observatory:read-terminal-buffer", async (_event, sessionId: string) => {
  return terminalManager.readBuffer(sessionId);
});

ipcMain.handle("observatory:start-watching-repo", async (_event, repoPath: string) => {
  startWatchingRepo(repoPath);
});

ipcMain.handle("observatory:stop-watching-repo", async () => {
  stopWatchingRepo();
});

ipcMain.handle("observatory:list-lessons", async () => lessonChapters);
ipcMain.handle("observatory:read-workspace", async (_event, repoPath: string) => workspaceAdapter.readWorkspace(repoPath));
ipcMain.handle("observatory:create-workspace-file", async (_event, repoPath: string, filePath: string, content: string) =>
  workspaceAdapter.createFile(repoPath, filePath, content)
);
ipcMain.handle("observatory:update-workspace-file", async (_event, repoPath: string, filePath: string, content: string) =>
  workspaceAdapter.updateFile(repoPath, filePath, content)
);
ipcMain.handle("observatory:delete-workspace-file", async (_event, repoPath: string, filePath: string) =>
  workspaceAdapter.deleteFile(repoPath, filePath)
);

app.whenReady().then(async () => {
  await sandboxManager.cleanupStaleSandboxes();
  mainWindow = createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("before-quit", (event) => {
  if (cleanupRequested) {
    return;
  }

  event.preventDefault();
  cleanupRequested = true;
  void cleanupAndQuitIfNeeded().finally(() => {
    app.exit(0);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
