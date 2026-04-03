# electron-runtime-debugging

## Purpose
Debug Electron main-process, preload, IPC, and renderer startup failures.

## Use when
- The app shows a blank window, IPC errors, or startup crashes.

## Do not use when
- The issue is only inside package-level business logic without Electron involvement.

## Inputs needed
- Error text
- Whether the failure is main process, preload, or renderer

## Relevant paths
- `apps/desktop-shell/src/main.ts`
- `apps/desktop-shell/src/preload.ts`
- `apps/desktop-shell/src/renderer/App.tsx`

## Workflow
1. Isolate which process is failing.
2. Verify preload-exposed APIs match renderer usage.
3. Reproduce with the smallest possible startup flow.

## Validation
- `npm test`
- `npm run build`
- `npm run test:e2e -- --reporter=line`

## Output format
- Failure layer, root cause, fix, validation evidence.

## Common mistakes
- Treating all Electron failures as renderer bugs.
