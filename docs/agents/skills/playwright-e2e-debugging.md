# playwright-e2e-debugging

## Purpose
Use the existing Playwright Electron setup to reproduce app-level regressions.

## Use when
- A bug requires real window, terminal, or integration behavior to validate.

## Do not use when
- A unit test is enough and no Electron behavior is involved.

## Inputs needed
- Repro flow
- Expected visible behavior

## Relevant paths
- `playwright.config.ts`
- `tests/e2e`
- `apps/desktop-shell`

## Workflow
1. Reproduce the smallest user-visible flow that proves the bug.
2. Prefer stable selectors and visible state checks.
3. Keep the e2e focused on one behavior per test.

## Validation
- `npm run test:e2e -- --reporter=line`

## Output format
- Test added or updated, bug reproduced, result after fix.

## Common mistakes
- Using an e2e test to cover behavior that should live in a unit test.
