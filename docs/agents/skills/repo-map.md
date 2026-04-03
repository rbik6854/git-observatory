# repo-map

## Purpose
Use the repository map to find the right package, app, or script before changing code.

## Use when
- A task spans multiple packages or the correct ownership boundary is unclear.

## Do not use when
- The task already names the exact file and no boundary decision is needed.

## Inputs needed
- Task goal
- Suspected subsystem

## Relevant paths
- `docs/agents/repo-map.md`
- `apps/desktop-shell`
- `packages/`

## Workflow
1. Read `docs/agents/repo-map.md`.
2. Confirm which package owns the behavior in question.
3. Keep edits inside the owning paths unless the task explicitly spans packages.

## Validation
- Confirm changed files match the owned paths in the task.

## Output format
- Short note naming the owning package or app.

## Common mistakes
- Starting implementation before confirming package ownership.
