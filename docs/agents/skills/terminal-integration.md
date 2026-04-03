# terminal-integration

## Purpose
Implement or debug the embedded terminal stack safely.

## Use when
- Tasks involve xterm, PTY input or output, paste, resize, collapse or expand behavior, or shell focus.

## Do not use when
- The task is about Git command correctness rather than the terminal host.

## Inputs needed
- Repro steps
- Active repo path if shell context matters

## Relevant paths
- `apps/desktop-shell/src/main.ts`
- `apps/desktop-shell/src/preload.ts`
- `apps/desktop-shell/src/renderer/App.tsx`
- `tests/e2e/terminal.spec.ts`

## Workflow
1. Verify whether the failure is PTY-side or renderer-side.
2. Prefer xterm's native input path over custom key translation.
3. Keep the terminal mounted across collapse or expand.
4. Add or update an e2e repro when fixing terminal regressions.

## Validation
- `npm test`
- `npm run build`
- `npm run test:e2e -- --reporter=line`

## Output format
- Root cause, files changed, tests run, remaining risks.

## Common mistakes
- Re-implementing terminal semantics in React handlers.
