# Hybrid Git Learning V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current desktop Git observability MVP into a documented, testable, desktop-first hybrid learning product that teaches Git internals through guided lessons, realistic workflows, and free experimentation.

**Architecture:** Decompose the current monolithic renderer and analysis layers into focused modules, add explicit curriculum and workflow contracts, extend the Git adapter for realistic teaching scenarios, and rebuild the desktop UI around clear product modes with stronger testing and documentation. The work is organized into bounded tracks so each stage can land with tests and remain merge-safe.

**Tech Stack:** TypeScript, React, Electron, Vite, Vitest, Playwright, npm workspaces

---

## Baseline Evidence

- `npm.cmd test` passes: 27 tests across 4 files
- `npm.cmd run build` passes
- Current renderer production bundle emits a Vite warning because `assets/index-*.js` is over 500 kB after minification
- Current high-risk implementation hotspots include:
  - `apps/desktop-shell/src/renderer/App.tsx`
  - `packages/core-analysis/src/index.ts`
  - `packages/desktop-git-adapter/src/index.ts`
  - `packages/core-lessons/src/index.ts`

## Track Decomposition

This spec is too large for one implementation stream. Execute in this order:

1. Product contracts and curriculum model
2. Domain and analysis decomposition
3. Git adapter realism and GitHub teaching model
4. Renderer shell and shared UI decomposition
5. Learning mode implementation and realistic workflows
6. Performance and bundle-size reduction
7. Documentation, verification, and release-quality checks

## File Structure Decisions

### New files to create

- `docs/product/requirements-matrix.md`
- `docs/product/curriculum-map.md`
- `docs/product/workflow-scenarios.md`
- `packages/core-domain/src/curriculum.ts`
- `packages/core-domain/src/workflows.ts`
- `packages/core-domain/src/github-model.ts`
- `packages/core-analysis/src/diffing.ts`
- `packages/core-analysis/src/explanations.ts`
- `packages/core-analysis/src/projection.ts`
- `packages/core-analysis/src/teaching.ts`
- `packages/core-lessons/src/chapters.ts`
- `packages/core-lessons/src/stories.ts`
- `packages/core-lessons/src/scenario-templates.ts`
- `packages/desktop-git-adapter/src/repo-inspection.ts`
- `packages/desktop-git-adapter/src/remote-inspection.ts`
- `packages/desktop-git-adapter/src/sandbox-factory.ts`
- `packages/desktop-git-adapter/src/workspace-files.ts`
- `packages/ui-shared/src/panels.tsx`
- `packages/ui-shared/src/graph-canvas.tsx`
- `packages/ui-shared/src/learning-chrome.tsx`
- `packages/ui-shared/src/status-panels.tsx`
- `apps/desktop-shell/src/renderer/hooks/useRepoSession.ts`
- `apps/desktop-shell/src/renderer/hooks/useStoryPlayer.ts`
- `apps/desktop-shell/src/renderer/hooks/useTerminalSession.ts`
- `apps/desktop-shell/src/renderer/components/AppShell.tsx`
- `apps/desktop-shell/src/renderer/components/HomeScreen.tsx`
- `apps/desktop-shell/src/renderer/components/LearningWorkspace.tsx`
- `apps/desktop-shell/src/renderer/components/PracticeWorkspace.tsx`
- `apps/desktop-shell/src/renderer/components/StoryWorkspace.tsx`
- `apps/desktop-shell/src/renderer/components/AdvancedInspector.tsx`
- `apps/desktop-shell/src/renderer/components/ModeSwitcher.tsx`
- `apps/desktop-shell/src/renderer/components/WorkflowExplainer.tsx`
- `apps/desktop-shell/src/renderer/components/GitHubBridgePanel.tsx`
- `apps/desktop-shell/src/renderer/components/LearningPathPanel.tsx`
- `apps/desktop-shell/src/renderer/components/RepoHealthBanner.tsx`
- `tests/e2e/practice-mode.spec.ts`
- `tests/e2e/lesson-mode.spec.ts`
- `tests/e2e/github-bridge.spec.ts`

### Existing files to modify

- `packages/core-domain/src/index.ts`
- `packages/core-analysis/src/index.ts`
- `packages/core-analysis/src/index.test.ts`
- `packages/core-lessons/src/index.ts`
- `packages/core-lessons/src/index.test.ts`
- `packages/desktop-git-adapter/src/index.ts`
- `packages/desktop-git-adapter/src/index.test.ts`
- `packages/ui-shared/src/index.tsx`
- `apps/desktop-shell/src/main.ts`
- `apps/desktop-shell/src/preload.ts`
- `apps/desktop-shell/src/renderer/App.tsx`
- `apps/desktop-shell/src/renderer/styles.css`
- `tests/e2e/terminal.spec.ts`
- `tests/e2e/story.spec.ts`

## Task 1: Freeze Product Contracts And Learning Matrix

**Files:**
- Create: `docs/product/requirements-matrix.md`
- Create: `docs/product/curriculum-map.md`
- Create: `docs/product/workflow-scenarios.md`
- Modify: `docs/superpowers/specs/2026-04-07-hybrid-git-learning-requirements-design.md`
- Test: `packages/core-lessons/src/index.test.ts`

- [ ] **Step 1: Write the failing lesson-contract tests**

```ts
import { describe, expect, it } from "vitest"
import { curriculumMap, workflowScenarios } from "./index"

describe("curriculum coverage", () => {
  it("maps every core concept to guided and exploratory surfaces", () => {
    const hashing = curriculumMap.find((item) => item.id === "hashing-and-addressing")
    expect(hashing?.guidedChapterIds.length).toBeGreaterThan(0)
    expect(hashing?.practiceScenarioIds.length).toBeGreaterThan(0)
  })

  it("marks realistic workflow scenarios as large-repo-faithful", () => {
    const scenario = workflowScenarios.find((item) => item.id === "feature-branch-rebase-release")
    expect(scenario?.realism.largeRepoFaithful).toBe(true)
    expect(scenario?.githubBridgeTopics).toContain("pull-request-mental-model")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- packages/core-lessons/src/index.test.ts`
Expected: FAIL because `curriculumMap` and `workflowScenarios` do not exist yet.

- [ ] **Step 3: Add product-facing curriculum and workflow contracts**

```ts
export interface CurriculumConcept {
  id: string
  title: string
  guidedChapterIds: string[]
  practiceScenarioIds: string[]
  githubBridgeTopics: string[]
}

export interface WorkflowScenarioContract {
  id: string
  title: string
  realism: {
    largeRepoFaithful: boolean
    simplifiedTeachingNotes: string[]
  }
  githubBridgeTopics: string[]
}
```

- [ ] **Step 4: Document the matrix and workflow scenarios**

Write markdown tables that map:

- concept -> lesson chapter -> practice scenario -> story scenario -> GitHub concept
- workflow -> learner goal -> internal structures -> realistic repo pressures -> validation surface

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm.cmd test -- packages/core-lessons/src/index.test.ts`
Expected: PASS with the new curriculum coverage assertions.

- [ ] **Step 6: Commit**

```bash
git add docs/product/requirements-matrix.md docs/product/curriculum-map.md docs/product/workflow-scenarios.md packages/core-lessons/src/index.ts packages/core-lessons/src/index.test.ts docs/superpowers/specs/2026-04-07-hybrid-git-learning-requirements-design.md
git commit -m "define-learning-contracts"
```

## Task 2: Split Core Domain Contracts By Responsibility

**Files:**
- Create: `packages/core-domain/src/curriculum.ts`
- Create: `packages/core-domain/src/workflows.ts`
- Create: `packages/core-domain/src/github-model.ts`
- Modify: `packages/core-domain/src/index.ts`
- Test: `packages/core-analysis/src/index.test.ts`

- [ ] **Step 1: Write the failing domain export tests**

```ts
import { describe, expect, it } from "vitest"
import { WorkflowScenario, GitHubTeachingTopic, CurriculumConcept } from "@git-observatory/core-domain"

describe("core domain exports", () => {
  it("exports curriculum and workflow contracts", () => {
    expectTypeOf<CurriculumConcept>().toBeObject()
    expectTypeOf<WorkflowScenario>().toBeObject()
    expectTypeOf<GitHubTeachingTopic>().toEqualTypeOf<string>()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- packages/core-analysis/src/index.test.ts`
Expected: FAIL because the new domain exports are missing.

- [ ] **Step 3: Move curriculum, workflow, and GitHub-specific types into focused modules**

```ts
export type GitHubTeachingTopic =
  | "pull-request-mental-model"
  | "branch-protection"
  | "merge-strategy-outcomes"
  | "review-feedback-loop"

export interface WorkflowScenario {
  id: string
  title: string
  coreConceptIds: string[]
  githubBridgeTopics: GitHubTeachingTopic[]
}
```

- [ ] **Step 4: Re-export from the package root without growing `index.ts` again**

```ts
export * from "./curriculum"
export * from "./workflows"
export * from "./github-model"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm.cmd test -- packages/core-analysis/src/index.test.ts`
Expected: PASS with the new exports available through `@git-observatory/core-domain`.

- [ ] **Step 6: Commit**

```bash
git add packages/core-domain/src/index.ts packages/core-domain/src/curriculum.ts packages/core-domain/src/workflows.ts packages/core-domain/src/github-model.ts packages/core-analysis/src/index.test.ts
git commit -m "split-domain-learning-contracts"
```

## Task 3: Split Core Analysis Into Diffing, Projection, Explanation, And Teaching

**Files:**
- Create: `packages/core-analysis/src/diffing.ts`
- Create: `packages/core-analysis/src/explanations.ts`
- Create: `packages/core-analysis/src/projection.ts`
- Create: `packages/core-analysis/src/teaching.ts`
- Modify: `packages/core-analysis/src/index.ts`
- Modify: `packages/core-analysis/src/index.test.ts`
- Test: `packages/core-analysis/src/index.test.ts`

- [ ] **Step 1: Write failing unit tests for internals-first explanations**

```ts
import { describe, expect, it } from "vitest"
import { explainCommandOutcome } from "./teaching"

describe("internals teaching explanations", () => {
  it("explains git add in working tree, index, and object terms", () => {
    const result = explainCommandOutcome("git add README.md", sampleDelta, sampleSnapshot)
    expect(result.internalChanges).toContain("index")
    expect(result.internalChanges).toContain("blob")
    expect(result.localVsRemote).toMatch(/local/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- packages/core-analysis/src/index.test.ts`
Expected: FAIL because `explainCommandOutcome` does not exist.

- [ ] **Step 3: Extract pure diffing and explanation modules**

```ts
export function explainCommandOutcome(rawCommand: string, delta: StateDelta, snapshot: RepoStateSnapshot) {
  const command = parseGitCommand(rawCommand)

  return {
    command,
    internalChanges: explainTransition(command, delta, snapshot),
    localVsRemote: snapshot.remoteState.upstreamRefName ? "local and remote state may both be relevant" : "local-only state change"
  }
}
```

- [ ] **Step 4: Keep the public API stable while shrinking file size**

```ts
export { diffSnapshots } from "./diffing"
export { projectGraph, projectGraphIncremental } from "./projection"
export { explainTransition, summarizeDelta } from "./explanations"
export { explainCommandOutcome } from "./teaching"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm.cmd test -- packages/core-analysis/src/index.test.ts`
Expected: PASS with tests covering new module boundaries.

- [ ] **Step 6: Commit**

```bash
git add packages/core-analysis/src/index.ts packages/core-analysis/src/index.test.ts packages/core-analysis/src/diffing.ts packages/core-analysis/src/explanations.ts packages/core-analysis/src/projection.ts packages/core-analysis/src/teaching.ts
git commit -m "split-analysis-engine"
```

## Task 4: Extend The Desktop Git Adapter For Realistic Teaching Scenarios

**Files:**
- Create: `packages/desktop-git-adapter/src/repo-inspection.ts`
- Create: `packages/desktop-git-adapter/src/remote-inspection.ts`
- Create: `packages/desktop-git-adapter/src/sandbox-factory.ts`
- Create: `packages/desktop-git-adapter/src/workspace-files.ts`
- Modify: `packages/desktop-git-adapter/src/index.ts`
- Modify: `packages/desktop-git-adapter/src/index.test.ts`
- Test: `packages/desktop-git-adapter/src/index.test.ts`

- [ ] **Step 1: Write failing adapter tests for realistic scenarios**

```ts
import { describe, expect, it } from "vitest"
import { LocalGitExecutionAdapter } from "./index"

describe("realistic scenario support", () => {
  it("creates a workflow sandbox that tracks local and remote state", async () => {
    const adapter = new LocalGitExecutionAdapter()
    const result = await adapter.createSandbox("auto-drive", tempRoot, "session-1", "workflow")
    expect(result.snapshot.remoteState.divergence).toBe("no-upstream")
    expect(result.sandbox.cleanupPaths?.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- packages/desktop-git-adapter/src/index.test.ts`
Expected: FAIL once the test references scenario helpers not yet extracted.

- [ ] **Step 3: Extract repo inspection and sandbox creation responsibilities**

```ts
export async function inspectRepoState(repoPath: string, options: RepoReadOptions = {}) {
  const gitDir = await resolveGitDir(repoPath)
  return inspectGitRepo(repoPath, gitDir, options)
}

export async function createTeachingSandbox(kind: SandboxKind, rootPath: string, sessionId: string, name = "git-observatory") {
  // Keeps disposable repo creation separate from repo inspection logic.
}
```

- [ ] **Step 4: Add scenario metadata needed by GitHub-through-Git teaching**

```ts
export interface RemoteTeachingState {
  upstreamRefName: string | null
  divergence: RemoteDivergenceStatus
  hostedCollaborationHint: string | null
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm.cmd test -- packages/desktop-git-adapter/src/index.test.ts`
Expected: PASS with coverage for sandbox creation, remote divergence, and large-repo truncation behavior.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop-git-adapter/src/index.ts packages/desktop-git-adapter/src/index.test.ts packages/desktop-git-adapter/src/repo-inspection.ts packages/desktop-git-adapter/src/remote-inspection.ts packages/desktop-git-adapter/src/sandbox-factory.ts packages/desktop-git-adapter/src/workspace-files.ts
git commit -m "split-git-adapter-and-scenarios"
```

## Task 5: Decompose Shared UI And Renderer Shell By Product Mode

**Files:**
- Create: `packages/ui-shared/src/panels.tsx`
- Create: `packages/ui-shared/src/graph-canvas.tsx`
- Create: `packages/ui-shared/src/learning-chrome.tsx`
- Create: `packages/ui-shared/src/status-panels.tsx`
- Create: `apps/desktop-shell/src/renderer/hooks/useRepoSession.ts`
- Create: `apps/desktop-shell/src/renderer/hooks/useStoryPlayer.ts`
- Create: `apps/desktop-shell/src/renderer/hooks/useTerminalSession.ts`
- Create: `apps/desktop-shell/src/renderer/components/AppShell.tsx`
- Create: `apps/desktop-shell/src/renderer/components/HomeScreen.tsx`
- Create: `apps/desktop-shell/src/renderer/components/LearningWorkspace.tsx`
- Create: `apps/desktop-shell/src/renderer/components/PracticeWorkspace.tsx`
- Create: `apps/desktop-shell/src/renderer/components/StoryWorkspace.tsx`
- Create: `apps/desktop-shell/src/renderer/components/AdvancedInspector.tsx`
- Modify: `packages/ui-shared/src/index.tsx`
- Modify: `apps/desktop-shell/src/renderer/App.tsx`
- Modify: `apps/desktop-shell/src/renderer/styles.css`
- Test: `tests/e2e/story.spec.ts`
- Test: `tests/e2e/terminal.spec.ts`

- [ ] **Step 1: Write failing UI flow tests for explicit mode boundaries**

```ts
test("home screen exposes curriculum, practice, and workflow entry points separately", async () => {
  await expect(page.getByRole("button", { name: "Start Learning Path" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open Practice Sandbox" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Watch Real Workflow" })).toBeVisible()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd run test:e2e -- tests/e2e/story.spec.ts`
Expected: FAIL because the new product-mode entry points are not implemented.

- [ ] **Step 3: Move renderer logic into focused hooks and mode components**

```tsx
export default function App() {
  return (
    <AppShell>
      <ModeSwitcher />
      <HomeScreen />
    </AppShell>
  )
}
```

- [ ] **Step 4: Keep shared presentational UI out of the renderer shell**

```tsx
export { Panel, EmptyState, InfoBadge } from "./panels"
export { GraphCanvas } from "./graph-canvas"
export { StatusPanel } from "./status-panels"
```

- [ ] **Step 5: Run e2e tests to verify they pass**

Run: `npm.cmd run test:e2e -- tests/e2e/story.spec.ts tests/e2e/terminal.spec.ts`
Expected: PASS with the existing story and terminal coverage updated for the new shell.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-shared/src/index.tsx packages/ui-shared/src/panels.tsx packages/ui-shared/src/graph-canvas.tsx packages/ui-shared/src/learning-chrome.tsx packages/ui-shared/src/status-panels.tsx apps/desktop-shell/src/renderer/App.tsx apps/desktop-shell/src/renderer/styles.css apps/desktop-shell/src/renderer/hooks/useRepoSession.ts apps/desktop-shell/src/renderer/hooks/useStoryPlayer.ts apps/desktop-shell/src/renderer/hooks/useTerminalSession.ts apps/desktop-shell/src/renderer/components/AppShell.tsx apps/desktop-shell/src/renderer/components/HomeScreen.tsx apps/desktop-shell/src/renderer/components/LearningWorkspace.tsx apps/desktop-shell/src/renderer/components/PracticeWorkspace.tsx apps/desktop-shell/src/renderer/components/StoryWorkspace.tsx apps/desktop-shell/src/renderer/components/AdvancedInspector.tsx tests/e2e/story.spec.ts tests/e2e/terminal.spec.ts
git commit -m "split-renderer-by-mode"
```

## Task 6: Implement Internals-First Learning And GitHub Bridge Surfaces

**Files:**
- Create: `apps/desktop-shell/src/renderer/components/WorkflowExplainer.tsx`
- Create: `apps/desktop-shell/src/renderer/components/GitHubBridgePanel.tsx`
- Create: `apps/desktop-shell/src/renderer/components/LearningPathPanel.tsx`
- Create: `apps/desktop-shell/src/renderer/components/RepoHealthBanner.tsx`
- Modify: `packages/core-lessons/src/chapters.ts`
- Modify: `packages/core-lessons/src/stories.ts`
- Modify: `apps/desktop-shell/src/renderer/components/LearningWorkspace.tsx`
- Modify: `apps/desktop-shell/src/renderer/components/StoryWorkspace.tsx`
- Test: `tests/e2e/lesson-mode.spec.ts`
- Test: `tests/e2e/github-bridge.spec.ts`

- [ ] **Step 1: Write failing e2e tests for GitHub-through-Git teaching**

```ts
test("lesson mode explains pull requests through branch and commit relationships", async () => {
  await page.getByRole("button", { name: "Start Learning Path" }).click()
  await expect(page.getByText("Pull request mental model")).toBeVisible()
  await expect(page.getByText(/branches, commits, and merge outcomes/i)).toBeVisible()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd run test:e2e -- tests/e2e/lesson-mode.spec.ts tests/e2e/github-bridge.spec.ts`
Expected: FAIL because the GitHub bridge surfaces do not exist yet.

- [ ] **Step 3: Add workflow explainer and GitHub bridge panels**

```tsx
export function GitHubBridgePanel(props: { topic: string; gitMapping: string[] }) {
  return (
    <Panel title="GitHub Through Git" subtitle="Hosted collaboration explained in Git terms">
      <ul>{props.gitMapping.map((item) => <li key={item}>{item}</li>)}</ul>
    </Panel>
  )
}
```

- [ ] **Step 4: Update lesson and story data to map concepts to practice and GitHub topics**

```ts
export const githubBridgeTopicsByScenario = {
  "feature-branch-rebase-release": ["pull-request-mental-model", "merge-strategy-outcomes", "branch-protection"]
} as const
```

- [ ] **Step 5: Run e2e tests to verify they pass**

Run: `npm.cmd run test:e2e -- tests/e2e/lesson-mode.spec.ts tests/e2e/github-bridge.spec.ts`
Expected: PASS with visible GitHub bridge explanations tied to live Git state.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-shell/src/renderer/components/WorkflowExplainer.tsx apps/desktop-shell/src/renderer/components/GitHubBridgePanel.tsx apps/desktop-shell/src/renderer/components/LearningPathPanel.tsx apps/desktop-shell/src/renderer/components/RepoHealthBanner.tsx packages/core-lessons/src/chapters.ts packages/core-lessons/src/stories.ts apps/desktop-shell/src/renderer/components/LearningWorkspace.tsx apps/desktop-shell/src/renderer/components/StoryWorkspace.tsx tests/e2e/lesson-mode.spec.ts tests/e2e/github-bridge.spec.ts
git commit -m "add-github-bridge-learning"
```

## Task 7: Reduce Renderer Bundle Size And Large-Repo Friction

**Files:**
- Modify: `apps/desktop-shell/vite.config.ts`
- Modify: `apps/desktop-shell/src/renderer/components/AppShell.tsx`
- Modify: `apps/desktop-shell/src/renderer/components/StoryWorkspace.tsx`
- Modify: `packages/core-analysis/src/projection.ts`
- Modify: `packages/desktop-git-adapter/src/repo-inspection.ts`
- Test: `tests/e2e/practice-mode.spec.ts`

- [ ] **Step 1: Write failing performance-facing assertions**

```ts
test("practice mode does not eagerly render every heavy surface on entry", async () => {
  await page.getByRole("button", { name: "Open Practice Sandbox" }).click()
  await expect(page.getByText("Git structure explorer")).toBeVisible()
  await expect(page.getByText("Advanced inspection")).not.toBeVisible()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:e2e -- tests/e2e/practice-mode.spec.ts`
Expected: FAIL if the shell still mounts all heavy surfaces eagerly.

- [ ] **Step 3: Add lazy loading and projection boundaries**

```tsx
const StoryWorkspace = lazy(() => import("./StoryWorkspace"))
const AdvancedInspector = lazy(() => import("./AdvancedInspector"))
```

```ts
export function projectGraphIncrementalCached(input: ProjectGraphInput, cache: GraphProjectionCache | null) {
  // Keep repeated large-repo work bounded to invalidated slices.
}
```

- [ ] **Step 4: Add Vite chunking for the renderer shell**

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        react: ["react", "react-dom"],
        xterm: ["@xterm/xterm", "@xterm/addon-fit"]
      }
    }
  }
}
```

- [ ] **Step 5: Run build and performance-facing tests**

Run: `npm.cmd run build && npm.cmd run test:e2e -- tests/e2e/practice-mode.spec.ts`
Expected: PASS, with the renderer chunk warning reduced or eliminated and practice mode still working.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop-shell/vite.config.ts apps/desktop-shell/src/renderer/components/AppShell.tsx apps/desktop-shell/src/renderer/components/StoryWorkspace.tsx packages/core-analysis/src/projection.ts packages/desktop-git-adapter/src/repo-inspection.ts tests/e2e/practice-mode.spec.ts
git commit -m "reduce-renderer-bundle-and-lag"
```

## Task 8: Final Documentation, Verification, And Release Evidence

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/agents/repo-map.md`
- Modify: `docs/product/requirements-matrix.md`
- Test: `tests/e2e/terminal.spec.ts`
- Test: `tests/e2e/story.spec.ts`
- Test: `tests/e2e/practice-mode.spec.ts`
- Test: `tests/e2e/lesson-mode.spec.ts`
- Test: `tests/e2e/github-bridge.spec.ts`

- [ ] **Step 1: Add documentation expectations as failing check items**

```md
- Product modes are documented
- Curriculum and practice relationship is documented
- GitHub-through-Git teaching model is documented
- Validation commands are documented
```

- [ ] **Step 2: Update repo-facing docs to match the new product**

```md
## Product Modes

- Guided Curriculum
- Practice Sandbox
- Workflow Story
- Advanced Inspection
```

- [ ] **Step 3: Run the full validation suite**

Run: `npm.cmd test`
Expected: PASS

Run: `npm.cmd run build`
Expected: PASS

Run: `npm.cmd run test:e2e`
Expected: PASS

Run: `npm.cmd run agents:check`
Expected: PASS

- [ ] **Step 4: Record final evidence in the docs**

Document:

- commands run
- current bundle size output
- passing test inventory
- known risks or deferred work

- [ ] **Step 5: Commit**

```bash
git add README.md CONTRIBUTING.md docs/agents/repo-map.md docs/product/requirements-matrix.md
git commit -m "document-v1-product-and-validation"
```

## Self-Review

### Spec coverage

The tasks above cover:

- frozen requirements documentation
- curriculum and workflow mapping
- internals-first teaching contracts
- GitHub-through-Git teaching
- realistic large-repo scenario support
- renderer and analysis decomposition
- performance and bundle-size work
- final verification and documentation

### Placeholder scan

The plan avoids `TODO`, `TBD`, and undefined “appropriate handling” language. Each track names files, concrete tests, and commands.

### Type consistency

The same contract names are used consistently across the plan:

- `CurriculumConcept`
- `WorkflowScenario`
- `GitHubTeachingTopic`
- `GitHubBridgePanel`
- `WorkflowExplainer`

## Execution Notes

- The current worktree already contains unrelated edits in product files. Implementation should avoid reverting or folding over those changes unless they are first reviewed and intentionally adopted.
- The plan assumes commits happen per task, not only once at the end.
- The plan assumes TDD for each track before implementation changes land.

## Recommended Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
