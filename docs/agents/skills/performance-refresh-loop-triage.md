# performance-refresh-loop-triage

## Purpose
Diagnose and reduce UI lag caused by redundant refreshes, excessive projection, or heavy watcher traffic.

## Use when
- The app feels laggy, refreshes repeatedly, or becomes hard to use during normal Git activity.

## Do not use when
- The slowdown is clearly from a one-time long-running Git command.

## Inputs needed
- Repro flow
- Whether the lag occurs during terminal use, external changes, or idle time

## Relevant paths
- `apps/desktop-shell/src/main.ts`
- `apps/desktop-shell/src/renderer/App.tsx`
- `packages/core-analysis/src/index.ts`
- `packages/desktop-git-adapter/src/index.ts`

## Workflow
1. Identify the repeated work source first.
2. Remove duplicate refresh triggers before optimizing algorithms.
3. Reduce refresh scope or watcher scope before adding more debounce.

## Validation
- `npm test`
- `npm run build`

## Output format
- Source of repeated work, fix, and observed improvement.

## Common mistakes
- Tuning delays when the real problem is duplicate event sources.
