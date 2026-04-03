# Repo Map

## Top level

- `apps/desktop-shell`
  - Electron main process, preload, renderer app, xterm integration, repo watch wiring
- `packages/core-domain`
  - serializable contracts, graph types, task/transition models
- `packages/core-analysis`
  - graph projection, explanations, layout logic, inspector modeling
- `packages/core-lessons`
  - lesson content and scenario definitions
- `packages/desktop-git-adapter`
  - Git CLI execution, repo inspection, workspace file operations
- `packages/ui-shared`
  - React panels and graph canvas rendering
- `tests/e2e`
  - Playwright Electron coverage
- `scripts/agents`
  - task normalization, task packets, worktree helpers, validation and recommendation helpers

## Ownership guidance

- Terminal behavior and Electron runtime issues:
  - `apps/desktop-shell/src/main.ts`
  - `apps/desktop-shell/src/preload.ts`
  - `apps/desktop-shell/src/renderer/App.tsx`
- Graph layout and node projection:
  - `packages/core-analysis/src/index.ts`
  - `packages/ui-shared/src/index.tsx`
- Git correctness and repo snapshots:
  - `packages/desktop-git-adapter/src/index.ts`
  - `packages/core-domain/src/index.ts`
- Shared contributor/agent system:
  - `docs/agents/`
  - `.agents/`
  - `.codex/`
  - `.claude/`
  - `.vscode/`
