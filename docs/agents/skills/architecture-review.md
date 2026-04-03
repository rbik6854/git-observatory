# architecture-review

## Purpose
Assess whether code structure, boundaries, and data flow match the repo's intended architecture.

## Use when
- A task requests architecture feedback, refactor direction, or design risk analysis.

## Do not use when
- The change is tiny and fully local to one file.

## Inputs needed
- Problem statement
- Subsystems affected

## Relevant paths
- `docs/agents/repo-map.md`
- `packages/core-domain`
- `packages/core-analysis`
- `packages/ui-shared`
- `apps/desktop-shell`

## Workflow
1. Map the behavior to the owning layers.
2. Identify coupling, duplication, or misplaced logic.
3. Recommend the smallest structural correction that restores clear boundaries.

## Validation
- Back recommendations with specific file or package references.

## Output format
- Findings, risks, and recommended structural changes.

## Common mistakes
- Proposing broad rewrites without tying them to current repo pain.
