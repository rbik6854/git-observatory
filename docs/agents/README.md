# Agent Contributor System

This repository is set up to be agent-native across Codex, Claude Code, and VS Code-style agent workflows.

## Operating model

- Canonical repo contracts live under `.agents/contracts/`.
- Canonical skills live under `docs/agents/skills/`.
- Tool-specific adapter files may change metadata or invocation, but not behavior.
- Every code task must map to an `AgentTaskSpec`.
- Every agent must produce an `AgentHandoff`.
- Parallel agents must have isolated write scopes and should use Git worktrees by default.

## Primary commands

- `npm install`
- `npm run build`
- `npm test`
- `npm run test:e2e`
- `npm run agents:check`
- `npm run agents:recommend`

## Typical workflow

1. Normalize a GitHub issue event or local task into `tasks/ready/`.
2. Generate an execution manifest and task packet.
3. Allocate one worktree per subtask.
4. Run the assigned role with the required skills.
5. Collect handoffs and merge in manifest order.

## Guardrails

- Do not change files outside the task's owned paths unless the task explicitly permits it.
- Always run the task's validation commands before handoff.
- Separate evidence from recommendations in review and recommendation work.
- Treat tool adapters as wrappers over the canonical docs, not alternate sources of truth.

## Architecture guide

For the full agent-system architecture, end-to-end flow, and developer usage model, read:

- `docs/agents/architecture.md`
- `docs/agents/examples/feature-example.md`
