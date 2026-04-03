# blank-window-triage

## Purpose
Recover quickly from a renderer crash or startup state that produces a blank app window.

## Use when
- The Electron window renders only a background or nothing useful.

## Do not use when
- The app loads and the issue is inside a specific flow or panel.

## Inputs needed
- Repro steps
- Whether the failure happens at startup or after a repo action

## Relevant paths
- `apps/desktop-shell/src/renderer/App.tsx`
- `apps/desktop-shell/src/preload.ts`
- `apps/desktop-shell/src/main.ts`

## Workflow
1. Reproduce the exact trigger.
2. Check for undefined variables, missing preload APIs, or runtime-only terminal errors.
3. Add a focused regression test when the failure path is stable.

## Validation
- `npm test`
- `npm run build`
- `npm run test:e2e -- --reporter=line`

## Output format
- Trigger, root cause, fix, and regression coverage.

## Common mistakes
- Fixing symptoms in CSS when the renderer is actually crashing.
