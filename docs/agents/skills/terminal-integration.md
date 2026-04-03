# terminal-integration

## Purpose
Implement or debug the embedded terminal stack safely.

## Use when
- Tasks involve xterm, PTY input or output, paste, resize, collapse or expand behavior, or shell focus.
- Tasks touch `apps/desktop-shell/src/renderer/App.tsx`, `src/main.ts`, or `src/preload.ts` in ways that could affect terminal lifecycle, repo switching, practice sandbox reset, or focus handling.

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
5. Confirm the xterm surface is mounted after repo load, not only on the landing screen.
6. Confirm the active session id is the only session whose output and lifecycle events are processed by the renderer.
7. Confirm practice sandbox reset closes the old terminal, clears stale session state, and attaches a fresh terminal for the new repo.
8. Treat any change in `App.tsx` around terminal mount, repo transition, or watcher flow as terminal-sensitive and run the full terminal e2e coverage before handoff.

## Validation
- `npm test`
- `npm run build`
- `npm run test:e2e -- --reporter=line`
- Manually verify:
  - typing works in the terminal after opening a repo
  - typing still works after collapse and expand
  - paste works
  - practice reset yields a fresh attached shell
  - terminal-driven commands still refresh the graph correctly

## Output format
- Root cause, files changed, tests run, remaining risks.

## Common mistakes
- Re-implementing terminal semantics in React handlers.
- Mounting xterm only once before the repo view exists.
- Processing terminal events from stale sessions after repo replacement.
- Letting repo-transition changes land without rerunning the terminal e2e flow.
- Depending on transient UI banners instead of validating terminal state and active repo state directly.

## Known terminal regression checklist

Before handoff, explicitly confirm all of these:

1. The terminal surface exists after creating or opening a repo.
2. The terminal accepts typed input.
3. The terminal accepts pasted input.
4. Collapse and expand preserve terminal usability.
5. Practice repo reset replaces the old session cleanly.
6. Terminal events from an old session are ignored after repo replacement.
7. The graph refresh still happens after terminal-entered Git commands.
