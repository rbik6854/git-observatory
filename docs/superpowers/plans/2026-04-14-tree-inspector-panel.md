# Tree Inspector Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side tree inspector so clicking a tree node shows its snapshot contents without expanding files inside the main graph.

**Architecture:** Keep the graph as the history/object relationship surface and use the existing right rail for detailed object inspection. The renderer already stores `treeInspections` keyed by tree object id and fetches tree objects on selection, so the implementation should derive the selected tree inspection from existing state and render it in a focused `TreeInspectorPanel` component. Large tree entries remain collapsed in the graph; the inspector uses a scrollable list for contents.

**Tech Stack:** Electron, React, TypeScript, Vitest, Playwright.

---

## File Structure

- Modify `packages/ui-shared/src/index.tsx`
  - Add a `TreeInspectorPanel` component that renders object id, file count, directory count, truncation state, and a scrollable list of tree entries.
  - Reuse existing `Panel`, `EmptyState`, and `truncate` helpers.
- Modify `apps/desktop-shell/src/renderer/App.tsx`
  - Derive the currently selected tree node from `selection` and `graph.nodes`.
  - Derive its `GitObjectInspection` from `treeInspections`.
  - Render `TreeInspectorPanel` below the Index panel only when a tree node is selected.
- Modify `apps/desktop-shell/src/renderer/styles.css`
  - Add fixed-height, scrollable tree inspector styles matching the existing Working Tree and Index panels.
- Modify `tests/e2e/terminal.spec.ts`
  - Add coverage for clicking a collapsed tree and inspecting its contents in the right rail.

Do not add a “Changes vs parent” tab in this phase. That belongs in a later phase because it requires parent-tree diff logic and separate teaching copy.

---

### Task 1: Add Tree Inspector Component

**Files:**
- Modify: `packages/ui-shared/src/index.tsx`

- [ ] **Step 1: Write the component API**

Add `GitObjectInspection` to the imports:

```ts
import {
  GitObjectInspection,
  GraphSelection,
  GraphViewModel,
  InspectorModel,
  InspectorTab
} from "@git-observatory/core-domain";
```

Add this exported component near `StatusPanel`:

```tsx
export function TreeInspectorPanel(props: {
  treeOid: string | null;
  inspection?: GitObjectInspection | null;
}) {
  const inspection = props.inspection?.type === "tree" ? props.inspection : null;
  const entries = inspection?.entries ?? [];
  const fileCount = entries.filter((entry) => entry.type === "blob").length;
  const directoryCount = entries.filter((entry) => entry.type === "tree").length;

  return (
    <Panel
      title="Tree Contents"
      subtitle="Selected commit snapshot"
    >
      {!props.treeOid ? (
        <EmptyState message="Select a tree node to inspect its tracked files." />
      ) : !inspection ? (
        <EmptyState message="Loading tree contents." />
      ) : (
        <div className="go-tree-inspector">
          <div className="go-tree-inspector__summary">
            <div className="go-field">
              <span>Object id</span>
              <code>{truncate(inspection.oid, 12)}</code>
            </div>
            <div className="go-tree-inspector__counts">
              <strong>{fileCount} {fileCount === 1 ? "file" : "files"}</strong>
              <strong>{directoryCount} {directoryCount === 1 ? "dir" : "dirs"}</strong>
            </div>
            {inspection.summary.truncated ? (
              <p>{inspection.summary.renderedEntries} of {inspection.summary.totalEntries} entries loaded.</p>
            ) : null}
          </div>

          {entries.length === 0 ? (
            <EmptyState message="This tree has no entries." />
          ) : (
            <div className="go-tree-entry-list">
              {entries.map((entry) => (
                <article className="go-tree-entry" key={`${entry.path}:${entry.oid}`}>
                  <div>
                    <strong>{entry.path}</strong>
                    <span>{entry.type === "tree" ? "directory" : "file"}</span>
                  </div>
                  <code>{truncate(entry.oid, 10)}</code>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
```

- [ ] **Step 2: Run TypeScript build and see the expected style failure or missing CSS only**

Run:

```powershell
npm.cmd run build
```

Expected at this point:

- TypeScript should compile if the import and component are correct.
- The UI will not be visually polished yet because CSS is added in Task 2.

- [ ] **Step 3: Commit**

```powershell
git add packages/ui-shared/src/index.tsx
git commit -m "add tree inspector component"
```

---

### Task 2: Style the Tree Inspector

**Files:**
- Modify: `apps/desktop-shell/src/renderer/styles.css`

- [ ] **Step 1: Add focused styles**

Append near the existing status panel styles:

```css
.go-tree-inspector {
  display: grid;
  min-height: 0;
}

.go-tree-inspector__summary {
  display: grid;
  gap: 0.55rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.go-tree-inspector__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.go-tree-inspector__counts strong {
  padding: 0.18rem 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  color: #7ee8a0;
  font-size: 0.72rem;
}

.go-tree-inspector__summary p {
  margin: 0;
  color: #b8beb4;
  font-size: 0.72rem;
}

.go-tree-entry-list {
  display: grid;
  gap: 0.35rem;
  max-height: 14rem;
  overflow: auto;
  padding: 0.45rem;
}

.go-tree-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: #101215;
}

.go-tree-entry div {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.go-tree-entry strong,
.go-tree-entry code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.go-tree-entry span {
  color: #b8beb4;
  font-size: 0.68rem;
}

.go-tree-entry code {
  flex: 0 0 auto;
  color: #d7f8df;
}
```

- [ ] **Step 2: Run build**

Run:

```powershell
npm.cmd run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

```powershell
git add apps/desktop-shell/src/renderer/styles.css
git commit -m "style tree inspector"
```

---

### Task 3: Wire Tree Selection into the Right Rail

**Files:**
- Modify: `apps/desktop-shell/src/renderer/App.tsx`

- [ ] **Step 1: Import the panel**

Change:

```ts
import { GraphCanvas, StatusPanel } from "@git-observatory/ui-shared";
```

to:

```ts
import { GraphCanvas, StatusPanel, TreeInspectorPanel } from "@git-observatory/ui-shared";
```

- [ ] **Step 2: Derive selected tree state**

After `indexItems`, add:

```ts
  const selectedTreeNode = useMemo(() => {
    if (!graph || !selection || !isNodeSelection(selection)) {
      return null;
    }

    const node = graph.nodes.find((item) => item.id === selection.id);
    return node?.type === "tree" ? node : null;
  }, [graph, selection]);

  const selectedTreeInspection = selectedTreeNode?.oid ? treeInspections[selectedTreeNode.oid] : null;
```

- [ ] **Step 3: Render the inspector only when a tree is selected**

Inside `<aside className="playground-state" ...>`, after the Index panel, add:

```tsx
          {selectedTreeNode ? (
            <div className="playground-state-panel">
              <TreeInspectorPanel
                inspection={selectedTreeInspection}
                treeOid={selectedTreeNode.oid}
              />
            </div>
          ) : null}
```

- [ ] **Step 4: Run build**

Run:

```powershell
npm.cmd run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

```powershell
git add apps/desktop-shell/src/renderer/App.tsx
git commit -m "show selected tree inspector"
```

---

### Task 4: Add Browser-Level Coverage

**Files:**
- Modify: `tests/e2e/terminal.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Add this test after `playground canvas collapses large committed tree contents`:

```ts
test("tree click opens a scrollable tree contents inspector", async () => {
  const electronApp = await electron.launch({
    executablePath: electronBinary as unknown as string,
    args: [path.join(desktopShellRoot, "dist-electron", "main.js")],
    cwd: desktopShellRoot,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "ELECTRON_RUN_AS_NODE"))
  });

  try {
    const page = await electronApp.firstWindow();

    await page.getByRole("button", { name: "New Playground" }).click();
    const repoPath = (await page.locator(".playground-path").textContent({ timeout: 30000 }))?.trim();
    if (!repoPath) {
      throw new Error("Playground path was not rendered.");
    }

    execFileSync("git", ["init"], { cwd: repoPath });
    execFileSync("git", ["config", "user.name", "Playground Test"], { cwd: repoPath });
    execFileSync("git", ["config", "user.email", "playground@example.test"], { cwd: repoPath });
    for (let index = 0; index < 8; index += 1) {
      writeFileSync(path.join(repoPath, `tree-file-${index}.txt`), `tree ${index}\n`);
    }
    execFileSync("git", ["add", "."], { cwd: repoPath });
    execFileSync("git", ["commit", "-m", "tree contents"], { cwd: repoPath });

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.locator(".go-node--tree")).toContainText("8 files");
    await page.locator(".go-node--tree").click();

    const inspector = page.locator(".playground-state-panel").filter({ hasText: "Tree Contents" });
    await expect(inspector).toContainText("Selected commit snapshot");
    await expect(inspector).toContainText("8 files");
    await expect(inspector).toContainText("0 dirs");
    await expect(inspector).toContainText("tree-file-0.txt");
    await expect(inspector).toContainText("tree-file-7.txt");

    const entryList = inspector.locator(".go-tree-entry-list");
    await expect(async () => {
      const dimensions = await entryList.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight
      }));
      expect(dimensions.scrollHeight).toBeGreaterThanOrEqual(dimensions.clientHeight);
    }).toPass();
  } finally {
    await electronApp.close();
  }
});
```

- [ ] **Step 2: Run the test before wiring if not already wired**

Run:

```powershell
npm.cmd run build
npm.cmd run test:e2e -- --grep "tree click opens"
```

Expected before Tasks 1-3 are complete: failure because `Tree Contents` does not exist.

Expected after Tasks 1-3 are complete: pass.

- [ ] **Step 3: Commit**

```powershell
git add tests/e2e/terminal.spec.ts
git commit -m "cover tree contents inspector"
```

---

### Task 5: Final Verification

**Files:**
- No new source files.

- [ ] **Step 1: Remove generated artifacts from the worktree**

Run:

```powershell
git status --short
git restore apps/desktop-shell/tsconfig.main.tsbuildinfo packages/core-analysis/tsconfig.tsbuildinfo packages/ui-shared/tsconfig.tsbuildinfo test-results/.last-run.json
```

Expected: generated `.tsbuildinfo` and `test-results/.last-run.json` are not staged.

- [ ] **Step 2: Run full validation**

Run:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run agents:check
npm.cmd run test:e2e
```

Expected:

- Unit tests pass.
- Build passes.
- Agent checks pass.
- E2E tests pass, including the new tree inspector test.

- [ ] **Step 3: Inspect final history**

Run:

```powershell
git status --short --branch
git log --oneline -8
```

Expected:

- Branch is `working-tree-index-panel`.
- Worktree is clean.
- New commits appear after `3f0f3c7 cap staged blob fanout`.

---

## Self-Review

- Spec coverage: This plan implements click tree → side inspector contents, object id, file count, directory count, and scrollable entries. It intentionally does not implement “Changes vs parent.”
- Placeholder scan: No placeholders or undefined future steps are required for this phase.
- Type consistency: The plan uses existing `GitObjectInspection`, `GraphSelection`, and graph node metadata; no new domain contract is required.
