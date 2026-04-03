# Repository Guidelines

## Project Structure & Module Organization
This is an npm workspace with Electron app code in `apps/` and reusable TypeScript packages in `packages/`.

- `apps/desktop-shell/`: Electron main, preload, and renderer entrypoints.
- `packages/core-domain/`, `core-analysis/`, `core-lessons/`: domain models, analysis logic, and lesson data.
- `packages/ui-shared/`: shared React UI components.
- `packages/desktop-git-adapter/`: local Git execution and snapshot adapters.
- `tests/e2e/`: Playwright end-to-end coverage.
- `docs/agents/`, `tasks/`, `templates/`, `scripts/agents/`: contributor workflow, task specs, and automation.

## Build, Test, and Development Commands
Run commands from the repository root.

- `npm run build`: builds shared packages, then the Electron desktop shell.
- `npm test`: runs Vitest unit tests across packages.
- `npm run test:e2e`: runs Playwright desktop end-to-end tests.
- `npm run agents:check`: validates agent adapters, task artifacts, and PR template expectations.
- `npm run agents:normalize -- --input tasks/inbox/<task>.json`: converts a task into canonical format.
- `npm run agents:packet -- --task tasks/ready/<task>.json`: creates a task packet for execution.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation, semicolons omitted, and double quotes, matching the existing source. Prefer named exports for shared contracts and keep modules focused.

Naming patterns:

- source files: `index.ts`, `main.ts`, `preload.ts`, `App.tsx`
- unit tests: `*.test.ts`
- end-to-end tests: `*.spec.ts`
- task artifacts: kebab-case JSON filenames in `tasks/`

No dedicated lint script is configured; keep formatting consistent with nearby files.

## Testing Guidelines
Add unit tests beside the package they verify and keep UI workflow tests in `tests/e2e/`. Cover behavior changes in the affected package before opening a PR. There is no explicit coverage gate in config, so aim for focused regression coverage on new logic and adapter changes.

## Commit & Pull Request Guidelines
Current history uses short, imperative summaries such as `initial-checkin` and `AI-Agents-ready`. Follow that style: concise subject line, repository-specific wording, and no filler.

Every meaningful change should map to a task id. Before opening a PR, run `npm test`, `npm run build`, and `npm run agents:check`. PRs should include the task id, acceptance criteria, validation evidence, and a brief handoff summary, following `CONTRIBUTING.md` and the PR template in `.github/`.
