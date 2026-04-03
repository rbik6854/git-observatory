# package-boundaries

## Purpose
Keep changes isolated to the package that owns the data flow or UI surface being modified.

## Use when
- A task touches shared types, graph projection, UI, or Electron integration.

## Do not use when
- The task is only about repo docs or task metadata.

## Inputs needed
- Task scope
- Files likely involved

## Relevant paths
- `packages/core-domain`
- `packages/core-analysis`
- `packages/ui-shared`
- `packages/desktop-git-adapter`
- `apps/desktop-shell`

## Workflow
1. Identify the source of truth for the behavior.
2. Push shared types down into `core-domain`.
3. Keep projection logic in `core-analysis`, UI in `ui-shared`, and runtime wiring in `desktop-shell`.

## Validation
- Confirm no package owns logic that belongs in another package.

## Output format
- Brief note on why the selected package boundary is correct.

## Common mistakes
- Putting domain logic into the renderer or Electron main process.
