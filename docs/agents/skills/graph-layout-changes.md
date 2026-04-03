# graph-layout-changes

## Purpose
Modify node placement, spacing, and edge readability without changing Git semantics.

## Use when
- Nodes overlap, labels collide, or the graph is visually hard to parse.

## Do not use when
- The task is about incorrect Git data rather than layout.

## Inputs needed
- Repro screenshot or flow
- Affected node types

## Relevant paths
- `packages/core-analysis/src/index.ts`
- `packages/ui-shared/src/index.tsx`
- `apps/desktop-shell/src/renderer/styles.css`

## Workflow
1. Confirm the data is correct before changing layout.
2. Change projection spacing before adding more CSS hacks.
3. Use labels sparingly and keep relationship semantics readable.

## Validation
- `npm test`
- `npm run build`

## Output format
- Root cause, layout change made, and screenshots or repro notes if available.

## Common mistakes
- Fixing overlap with typography alone when the projector is placing nodes in the same slot.
