# Git Internals Observatory

Desktop-first Git observability workspace with web-ready package boundaries.

## Packages

- `packages/core-domain`: serializable domain types and command parsing/risk classification
- `packages/core-analysis`: snapshot diffing and explanation helpers
- `packages/core-lessons`: data-driven lesson and workflow scenarios
- `packages/ui-shared`: React observability panels
- `packages/desktop-git-adapter`: local Git execution and snapshot extraction
- `apps/desktop-shell`: Electron shell and renderer UI

## Status

This repository is scaffolded as an initial MVP for:

- guided internals curriculum
- sandbox lab
- open repo analysis
- serializable snapshot/transition payloads
- Electron shell with a reusable UI layer

## Commands

After installing dependencies:

```bash
npm install
npm run build
npm test
```

## Run Locally

This project is currently run as an Electron desktop app from the workspace root.

1. Install dependencies:

```bash
npm install
```

2. Build the shared packages and desktop shell:

```bash
npm run build
```

3. Start the Electron app:

```bash
npm run start -w @git-observatory/desktop-shell
```

Useful validation commands:

```bash
npm test
npm run test:e2e
npm run agents:check
```

The desktop app currently implements the architectural spine and an initial end-to-end observability flow. The shared packages are structured so a future web shell can reuse the same snapshot, transition, lesson, and visualization contracts.
