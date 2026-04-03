# git-state-correctness-check

## Purpose
Verify that the app is representing real Git behavior correctly.

## Use when
- A user reports that the UI disagrees with what Git should be doing.

## Do not use when
- The issue is purely visual and the underlying Git state is already known to be correct.

## Inputs needed
- Repro steps
- Repo state or command sequence

## Relevant paths
- `packages/desktop-git-adapter/src/index.ts`
- `packages/core-analysis/src/index.ts`
- `tests/e2e`

## Workflow
1. Reproduce the sequence with real Git commands.
2. Validate expected state with Git plumbing or porcelain.
3. Compare the app snapshot and graph against that state.

## Validation
- `npm test`
- `npm run build`

## Output format
- Real Git behavior, app mismatch, fix or open question.

## Common mistakes
- Assuming user intuition is wrong without checking real Git output.
