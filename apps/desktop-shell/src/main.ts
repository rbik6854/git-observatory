import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { app, BrowserWindow, ipcMain } from "electron";
import chokidar, { type FSWatcher } from "chokidar";
import {
  RepoWatchEvent,
  SandboxCreationResult,
  SandboxDescriptor,
  SandboxKind,
  SandboxManager
} from "@git-observatory/core-domain";
import { LocalGitExecutionAdapter } from "@git-observatory/desktop-git-adapter";

const gitAdapter = new LocalGitExecutionAdapter();
const sessionId = `${Date.now()}`;
const sandboxRoot = path.join(os.tmpdir(), "git-observatory");
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

  private sandboxCleanupTargets(sandbox: SandboxDescriptor): string[] {
    return Array.from(new Set([sandbox.repoPath, ...(sandbox.cleanupPaths ?? [])]));
  }

  private async removeSandboxTargets(sandbox: SandboxDescriptor): Promise<void> {
    for (const target of this.sandboxCleanupTargets(sandbox)) {
      await removeDirectoryBestEffort(target);
    }
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
          await this.removeSandboxTargets(sandbox);
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

  async removeSandbox(repoPath: string): Promise<void> {
    const sandbox = this.sandboxes.get(repoPath);
    if (!sandbox) {
      return;
    }

    try {
      await this.removeSandboxTargets(sandbox);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "EBUSY" || code === "EPERM") {
        console.warn(`Sandbox removal deferred for locked path ${sandbox.repoPath}`);
        return;
      }
      throw error;
    }

    this.sandboxes.delete(repoPath);
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

function isIgnoredGitMetadataPath(relativePath: string | null): boolean {
  if (!relativePath) {
    return true;
  }

  return (
    relativePath === ".git" ||
    relativePath.startsWith(".git/objects/") ||
    relativePath.startsWith(".git/hooks/") ||
    relativePath.startsWith(".git/info/") ||
    relativePath === ".git/index.lock" ||
    relativePath === ".git/COMMIT_EDITMSG"
  );
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

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function trySpawnDetached(command: string, args: string[], cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    try {
      const child = spawn(command, args, {
        cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: true
      });
      child.once("error", () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      });
      child.once("spawn", () => {
        if (!settled) {
          settled = true;
          child.unref();
          resolve(true);
        }
      });
      setTimeout(() => {
        if (!settled) {
          settled = true;
          child.unref();
          resolve(true);
        }
      }, 60);
    } catch {
      resolve(false);
    }
  });
}

function tryStartWindowsTerminal(cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    try {
      const child = spawn(
        "cmd.exe",
        ["/c", "start", "\"\"", "powershell.exe", "-NoExit", "-Command", `Set-Location -LiteralPath '${escapePowerShellLiteral(cwd)}'`],
        {
          cwd,
          detached: true,
          stdio: "ignore",
          windowsHide: false
        }
      );
      child.once("error", () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      });
      child.once("spawn", () => {
        if (!settled) {
          settled = true;
          child.unref();
          resolve(true);
        }
      });
      setTimeout(() => {
        if (!settled) {
          settled = true;
          child.unref();
          resolve(true);
        }
      }, 120);
    } catch {
      resolve(false);
    }
  });
}

async function openSystemTerminal(cwd: string): Promise<void> {
  if (process.platform === "win32") {
    if (await trySpawnDetached("wt.exe", ["-d", cwd], cwd)) {
      return;
    }

    if (await tryStartWindowsTerminal(cwd)) {
      return;
    }

    throw new Error("Failed to open a system terminal for this repository.");
  }

  if (process.platform === "darwin") {
    if (await trySpawnDetached("open", ["-a", "Terminal", cwd], cwd)) {
      return;
    }
    throw new Error("Failed to open Terminal.app for this repository.");
  }

  const linuxCandidates: Array<[string, string[]]> = [
    ["x-terminal-emulator", ["--working-directory", cwd]],
    ["gnome-terminal", ["--working-directory", cwd]],
    ["konsole", ["--workdir", cwd]],
    ["xfce4-terminal", ["--working-directory", cwd]]
  ];

  for (const [command, args] of linuxCandidates) {
    if (await trySpawnDetached(command, args, cwd)) {
      return;
    }
  }

  throw new Error("Failed to open a system terminal for this repository.");
}

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
    if (!changedPath || isIgnoredGitMetadataPath(changedPath)) {
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
      ignored: [/(^|[\\/])\.git([\\/]|$)/, /(^|[\\/])node_modules([\\/]|$)/],
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 180,
        pollInterval: 50
      }
    });

    const metadataWatcher = chokidar.watch(path.join(repoPath, ".git"), {
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
  await sandboxManager.cleanupSessionSandboxes();
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#101114",
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

ipcMain.handle("observatory:create-sandbox", async (_event, kind: SandboxKind, name?: string) => {
  const result = await sandboxManager.createSandbox(kind, name);
  startWatchingRepo(result.repoPath);
  return result;
});

ipcMain.handle("observatory:inspect-repo", async (_event, repoPath: string) => {
  return gitAdapter.inspectRepo(repoPath);
});

ipcMain.handle("observatory:inspect-repo-with-options", async (_event, repoPath: string, options) => {
  return gitAdapter.inspectRepo(repoPath, options);
});

ipcMain.handle("observatory:inspect-object", async (_event, repoPath: string, oid: string) => {
  return gitAdapter.inspectObject(repoPath, oid);
});

ipcMain.handle("observatory:inspect-object-with-options", async (_event, repoPath: string, oid: string, options) => {
  return gitAdapter.inspectObject(repoPath, oid, options);
});

ipcMain.handle("observatory:open-system-terminal", async (_event, cwd: string) => {
  await openSystemTerminal(cwd);
});

ipcMain.handle("observatory:start-watching-repo", async (_event, repoPath: string) => {
  startWatchingRepo(repoPath);
});

ipcMain.handle("observatory:stop-watching-repo", async () => {
  stopWatchingRepo();
});

ipcMain.handle("observatory:remove-sandbox", async (_event, repoPath: string) => {
  stopWatchingRepo();
  try {
    await sandboxManager.removeSandbox(repoPath);
  } catch (error) {
    console.error(`Failed to remove sandbox ${repoPath}`, error);
  }
});

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
