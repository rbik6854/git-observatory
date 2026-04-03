# inspector-ui-work

## Purpose
Improve the right-side inspector without turning it into a text dump.

## Use when
- A task changes selection details, explanation panels, command cards, or collapse behavior.

## Do not use when
- The task is about graph projection or terminal runtime only.

## Inputs needed
- Selected item types affected
- Desired interaction change

## Relevant paths
- `packages/ui-shared/src/index.tsx`
- `apps/desktop-shell/src/renderer/App.tsx`
- `apps/desktop-shell/src/renderer/styles.css`

## Workflow
1. Keep the graph primary and the inspector contextual.
2. Prefer short cards and sections over large paragraphs.
3. Make optional panels collapsible when they are not always needed.

## Validation
- `npm test`
- `npm run build`

## Output format
- UI change summary and any interaction notes.

## Common mistakes
- Forcing verbose explanations into the default state.
