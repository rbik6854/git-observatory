# ux-critique

## Purpose
Evaluate the current UI for clarity, flow, and interaction quality.

## Use when
- A task asks for UX review, friction analysis, or interface recommendations.

## Do not use when
- The task is purely backend or contract focused.

## Inputs needed
- Target flow
- Screens or repro steps if available

## Relevant paths
- `apps/desktop-shell/src/renderer/App.tsx`
- `apps/desktop-shell/src/renderer/styles.css`
- `packages/ui-shared/src/index.tsx`

## Workflow
1. Reproduce the flow directly.
2. Identify workflow blockers before visual polish issues.
3. Tie every recommendation to a concrete UI state.

## Validation
- Document the exact flow reviewed and any screenshots used.

## Output format
- Findings, impact, and recommended changes.

## Common mistakes
- Giving generic design opinions without grounding them in the app.
