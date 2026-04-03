# repo-watch-refresh

## Purpose
Keep the UI reactive to meaningful repo changes without refresh loops or watcher noise.

## Use when
- The app refreshes too often, misses changes, or responds poorly to external Git activity.

## Do not use when
- The problem is purely visual and unrelated to repo events.

## Inputs needed
- Repro steps
- Whether changes come from the app terminal or an external terminal

## Relevant paths
- `apps/desktop-shell/src/main.ts`
- `apps/desktop-shell/src/renderer/App.tsx`
- `packages/desktop-git-adapter/src/index.ts`

## Workflow
1. Identify the event source: watcher, terminal, manual refresh, or projection.
2. Coalesce repo events before refreshing.
3. Ignore noisy paths unless they materially change visible Git state.

## Validation
- `npm test`
- `npm run build`

## Output format
- Event source, throttle or watcher change, and observed result.

## Common mistakes
- Refreshing on raw terminal output or every file-system event.
