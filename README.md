# Git Observatory

Git Observatory is a desktop app for learning Git by watching repository state change in real time.

The current app creates a disposable practice repository, opens a terminal in that repository, and renders the Git structures affected by the commands you run. It focuses on the relationship between commits, refs, trees, blobs, the index, and the working tree.

## Current Capabilities

- Create a temporary Git playground from the desktop app
- Open a system terminal directly in the playground repository
- Refresh automatically when repository files or Git metadata change
- Render a visual graph of commits, refs, trees, and blobs
- Inspect working tree changes and staged index entries side by side
- Select tree nodes to inspect committed tree contents
- Capture serializable repository snapshots for analysis and UI rendering
- Keep core Git state logic separate from the Electron shell and React UI

## Project Structure

This repository is an npm workspace with the Electron app in `apps/` and reusable TypeScript packages in `packages/`.

- `apps/desktop-shell`: Electron main process, preload bridge, and renderer entrypoint
- `packages/core-domain`: shared Git state types, command parsing, risk classification, and snapshot contracts
- `packages/core-analysis`: snapshot diffing, transition explanations, and graph projection logic
- `packages/ui-shared`: shared React panels for graph, status, and tree inspection views
- `packages/desktop-git-adapter`: local Git execution, sandbox creation, and repository snapshot extraction
- `tests/e2e`: Playwright coverage for desktop workflows
- `docs/agents`, `tasks`, `templates`, `scripts/agents`: task and agent workflow support

## Requirements

- Node.js 22 or newer
- npm
- Git available on your `PATH`

## Run Locally

Install dependencies from the workspace root:

```bash
npm install
```

Build the shared packages and Electron shell:

```bash
npm run build
```

Start the desktop app:

```bash
npm run start -w @git-observatory/desktop-shell
```

In the app, choose **New Playground**, then use **Open System Terminal** to run Git commands inside the generated practice repository. The graph and state panels update as the repository changes.

## Useful Commands

```bash
npm test
npm run build
npm run test:e2e
npm run agents:check
```

- `npm test`: runs Vitest unit tests across the workspace
- `npm run build`: builds shared packages and the Electron desktop shell
- `npm run test:e2e`: runs Playwright desktop workflow tests
- `npm run agents:check`: validates agent workflow contracts and task artifacts

## Development Notes

The app currently runs as a local Electron playground rather than a packaged desktop release. Sandboxes are created under the operating system temp directory and cleaned up by the Electron shell when possible.

The codebase is structured so future shells or workflows can reuse the same snapshot, transition, and visualization contracts without depending directly on Electron.
