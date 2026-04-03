# test-gap-analysis

## Purpose
Identify missing coverage around bugs, new features, and risky subsystems.

## Use when
- A task asks for review, risk assessment, or guidance on missing tests.

## Do not use when
- The task already includes a precise failing test to implement.

## Inputs needed
- Changed files
- Validation commands already run

## Relevant paths
- `packages/**/*.test.ts`
- `tests/**/*.spec.ts`
- `vitest.config.ts`
- `playwright.config.ts`

## Workflow
1. Map changed behavior to existing unit or e2e coverage.
2. Identify the highest-value missing assertion or scenario.
3. Distinguish required coverage from optional follow-up coverage.

## Validation
- `npm test`
- `npm run test:e2e -- --reporter=line`

## Output format
- Coverage present, gaps, and recommended test additions.

## Common mistakes
- Calling for more tests without naming the exact missing behavior.
