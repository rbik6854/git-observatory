# workspace-commands

## Purpose
Use the correct repo commands for build, test, and package-scoped work.

## Use when
- A task requires validation or package-specific commands.

## Do not use when
- The task is documentation-only and requires no repo validation.

## Inputs needed
- Task validation commands
- Target package if the work is scoped

## Relevant paths
- `package.json`
- `apps/desktop-shell/package.json`

## Workflow
1. Read root `package.json` scripts first.
2. Prefer the task's declared validation commands over invented ones.
3. Use workspace-scoped npm commands when only one package is affected.

## Validation
- `npm test`
- `npm run build`

## Output format
- List of commands run and whether they passed.

## Common mistakes
- Running unrelated commands that slow down iteration or muddy evidence.
