# Playground-Only Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the Electron app to a playground-only Git visualization shell with no in-app terminal, repo picker, lessons, story mode, or redundant UI.

**Architecture:** The renderer becomes a small state machine for launching a disposable playground, watching it, refreshing repository snapshots, and projecting the snapshot into the existing `GraphCanvas`. The main process keeps sandbox, repository inspection, object inspection, repo watching, sandbox cleanup, and system terminal handoff IPC only. Old learning, story, embedded terminal, workspace editor, and command-runner surfaces are removed from the desktop shell.

**Tech Stack:** Electron, React, TypeScript, Vite, Playwright, Vitest, existing `@git-observatory/core-analysis`, `@git-observatory/core-domain`, `@git-observatory/desktop-git-adapter`, and `@git-observatory/ui-shared` packages.

---

### Task 1: Replace Old E2E Contracts With Playground-Only Contracts

**Files:**
- Modify: `tests/e2e/terminal.spec.ts`
- Delete: `tests/e2e/story.spec.ts`

- [ ] **Step 1: Replace the terminal e2e test with a playground shell test**

Use this content in `tests/e2e/terminal.spec.ts`:

```ts
import path from "node:path";
import { test, expect, _electron as electron } from "@playwright/test";
import electronBinary from "electron";

const workspaceRoot = path.resolve(__dirname, "..", "..");
const desktopShellRoot = path.join(workspaceRoot, "apps", "desktop-shell");

test("playground shell creates a repo without embedded terminal UI", async () => {
  const electronApp = await electron.launch({
    executablePath: electronBinary as unknown as string,
    args: [path.join(desktopShellRoot, "dist-electron", "main.js")],
    cwd: desktopShellRoot,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "ELECTRON_RUN_AS_NODE"))
  });

  try {
    const page = await electronApp.firstWindow();

    await expect(page.getByRole("heading", { name: "Git Observatory" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Playground" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Open Repo/i })).toHaveCount(0);
    await expect(page.getByText(/terminal/i)).toHaveCount(0);

    await page.getByRole("button", { name: "New Playground" }).click();

    await expect(page.getByRole("heading", { name: "Git Observatory" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Open System Terminal" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(page.locator(".go-graph-scroll")).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".go-terminal-host")).toHaveCount(0);
    await expect(page.locator(".graph-terminal-drawer")).toHaveCount(0);
  } finally {
    await electronApp.close();
  }
});
```

- [ ] **Step 2: Delete the story e2e test**

Delete `tests/e2e/story.spec.ts` because story mode is out of scope for the playground-only shell.

- [ ] **Step 3: Run the e2e test to verify it fails against the old UI**

Run: `npm run build && npx playwright test tests/e2e/terminal.spec.ts`

Expected before implementation: FAIL because the old launcher exposes old mode names and the old renderer still contains terminal UI.

### Task 2: Simplify Renderer To Playground State And Canvas

**Files:**
- Replace: `apps/desktop-shell/src/renderer/App.tsx`
- Replace: `apps/desktop-shell/src/renderer/styles.css`

- [ ] **Step 1: Replace `App.tsx` with the playground-only renderer**

The renderer should import only React hooks, graph projection helpers, domain types needed by the canvas, and `GraphCanvas`.

Key implementation shape:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphProjectionCache, projectGraphIncremental } from "@git-observatory/core-analysis";
import { GitObjectInspection, GraphExpansionState, GraphSelection, GraphVisibilityFilters, RepoStateSnapshot, SandboxDescriptor } from "@git-observatory/core-domain";
import { GraphCanvas } from "@git-observatory/ui-shared";

const graphVisibility: GraphVisibilityFilters = {
  showRefs: true,
  showTrees: true,
  showBlobs: true,
  showTags: true
};

const initialExpansion: GraphExpansionState = {
  expandedTreeOids: []
};

export default function App() {
  const [repoPath, setRepoPath] = useState("");
  const [sandbox, setSandbox] = useState<SandboxDescriptor | null>(null);
  const [snapshot, setSnapshot] = useState<RepoStateSnapshot | null>(null);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [treeInspections, setTreeInspections] = useState<Record<string, GitObjectInspection | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const cacheRef = useRef<GraphProjectionCache | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const graph = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    const result = projectGraphIncremental({
      snapshot,
      selection,
      visibilityFilters: graphVisibility,
      expansionState: initialExpansion,
      treeInspections,
      includeIndexBlobs: true,
      cache: cacheRef.current
    });

    cacheRef.current = result.cache;
    return result.graph;
  }, [selection, snapshot, treeInspections]);

  const refreshSnapshot = useCallback(async (path = repoPath) => {
    if (!path) {
      return;
    }

    try {
      const nextSnapshot = await window.gitObservatory.inspectRepo(path);
      setSnapshot(nextSnapshot);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to refresh playground.");
    }
  }, [repoPath]);

  async function createPlayground() {
    setBusy(true);
    setError(null);
    setSelection(null);
    setTreeInspections({});
    cacheRef.current = null;

    try {
      if (repoPath) {
        await window.gitObservatory.removeSandbox(repoPath);
      }
      const result = await window.gitObservatory.createSandbox("practice", "playground");
      setRepoPath(result.repoPath);
      setSandbox(result.sandbox);
      setSnapshot(result.snapshot);
      setLastUpdated(new Date().toLocaleTimeString());
      await window.gitObservatory.startWatchingRepo(result.repoPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create playground.");
    } finally {
      setBusy(false);
    }
  }
}
```

Complete the component with:

- a minimal empty state containing `Git Observatory` and `New Playground`
- a ready state containing a thin top bar and a large canvas region
- `Open System Terminal`, `Refresh`, and `Reset Playground` buttons
- repo watch subscription that debounces `refreshSnapshot`
- tree node selection support that calls `inspectObjectWithOptions` for tree OIDs before setting selection
- no embedded terminal state, xterm setup, story state, lesson state, workspace editor state, command execution UI, or repo-open UI

- [ ] **Step 2: Replace `styles.css` with lean canvas-first styles**

The stylesheet should define only:

- global dark app basics
- button and status styles
- `.playground-app`
- `.playground-launcher`
- `.playground-topbar`
- `.playground-canvas`
- required graph classes used by `GraphCanvas`: `.go-panel`, `.go-panel__header`, `.go-panel__body`, `.go-graph-scroll`, `.go-graph-stage`, `.go-graph-svg`, `.go-graph-edge`, `.go-graph-edge-label`, `.go-node`, `.go-legend`, `.go-empty`, and responsive variants

The stylesheet must not include terminal, story, landing-card, editor, inspector rail, command card, or movie-guide classes.

- [ ] **Step 3: Run the e2e test**

Run: `npm run build && npx playwright test tests/e2e/terminal.spec.ts`

Expected after renderer implementation: PASS unless main/preload still exposes stale terminal code that breaks compile.

### Task 3: Remove Embedded Terminal, Lessons, Open Repo, And Workspace IPC From Desktop Shell

**Files:**
- Modify: `apps/desktop-shell/src/main.ts`
- Modify: `apps/desktop-shell/src/preload.ts`
- Modify: `apps/desktop-shell/src/renderer/electron.d.ts`
- Modify: `apps/desktop-shell/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Remove stale preload APIs and renderer types**

Keep only:

```ts
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
```

Remove preload methods and type imports for:

- `openRepo`
- `inspectRemote`
- `runGitCommand`
- all embedded terminal methods and events
- `listLessons`
- all workspace read/edit methods

- [ ] **Step 2: Remove stale main-process imports, fields, classes, and IPC handlers**

Remove:

- `dialog`
- `node-pty`
- `IPty`
- `TerminalEvent`
- `TerminalSessionDescriptor`
- `lessonChapters`
- `LocalWorkspaceAdapter`
- `workspaceAdapter`
- `terminalChannel`
- `TerminalManager`
- all `observatory:create-terminal`, `write-terminal`, `resize-terminal`, `close-terminal`, `read-terminal-buffer` handlers
- `observatory:open-repo`
- `observatory:inspect-remote`
- `observatory:run-command`
- `observatory:list-lessons`
- all `observatory:read-workspace*`, `create-workspace-file`, `update-workspace-file`, and `delete-workspace-file` handlers

Keep sandbox cleanup, repo watching, object inspection, system terminal handoff, and sandbox removal.

- [ ] **Step 3: Remove unneeded app dependencies**

In `apps/desktop-shell/package.json`, remove:

```json
"@git-observatory/core-lessons": "0.1.0",
"@xterm/addon-fit": "^0.11.0",
"@xterm/xterm": "^6.0.0",
"node-pty": "^1.1.0"
```

Run: `npm install`

Expected: `package-lock.json` updates and no install errors.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS. If TypeScript reports stale imports, remove the stale imports rather than reintroducing old functionality.

### Task 4: Remove Unused Shared UI Terminal Surface

**Files:**
- Modify: `packages/ui-shared/src/index.tsx`

- [ ] **Step 1: Remove terminal model import and any terminal component props**

Remove `TerminalSessionModel` from imports and delete any shared terminal component that is no longer used by the app. Keep `Panel`, `EmptyState`, `GraphCanvas`, and graph node rendering exports.

- [ ] **Step 2: Run package tests**

Run: `npm test`

Expected: PASS for package unit tests. If tests fail because they reference removed UI exports, delete or rewrite those test references to the playground-only contract.

### Task 5: Final Verification

**Files:**
- Verify all touched files

- [ ] **Step 1: Search for removed surfaces**

Run:

```bash
rg "createTerminal|writeTerminal|readTerminalBuffer|TerminalSessionDescriptor|TerminalEvent|node-pty|@xterm|Watch Git Story|Create Practice Repo|Open Repo|listLessons|readWorkspace|go-terminal|storyScripts|lessonChapters" apps tests packages/ui-shared
```

Expected: no matches in `apps`, `tests`, or `packages/ui-shared`.

- [ ] **Step 2: Run required validation**

Run:

```bash
npm test
npm run build
npm run agents:check
```

Expected: all commands exit 0.

- [ ] **Step 3: Report remaining intentional code**

If lesson/domain packages still contain lesson or story models, report that they are retained because they are workspace packages outside the desktop shell and can be removed in a separate package-pruning task after checking downstream package tests.
