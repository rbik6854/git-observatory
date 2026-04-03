# git-object-projection

## Purpose
Keep the graph faithful to real Git objects, refs, and relationships.

## Use when
- The UI shows incorrect commit, tree, blob, ref, or HEAD relationships.

## Do not use when
- The problem is only layout or styling.

## Inputs needed
- Repro steps
- Exact Git state or command sequence

## Relevant paths
- `packages/core-analysis/src/index.ts`
- `packages/core-domain/src/index.ts`
- `packages/desktop-git-adapter/src/index.ts`

## Workflow
1. Confirm the real Git state with plumbing commands first.
2. Compare adapter snapshot output against actual Git output.
3. Fix projection from normalized snapshot data, not from UI assumptions.

## Validation
- `npm test`
- `npm run build`

## Output format
- Expected Git behavior, observed mismatch, projection fix.

## Common mistakes
- Inferring object relationships from the current index when the source should be committed tree data.
