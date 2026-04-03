# Contributing

This repository is set up to support both human contributors and agentic coding environments, but the default workflow is now agent-first.

If you are contributing code, analysis, or recommendations, start from the agent system instead of improvising a one-off process.

## Start here

Read these in order:

1. `docs/agents/README.md`
2. `docs/agents/architecture.md`
3. `docs/agents/repo-map.md`
4. `docs/agents/skills/`
5. `docs/agents/examples/feature-example.md`
6. `tasks/README.md`

## Default contributor workflow

### 1. Create or identify a task

Use one of these sources:

- a local task JSON under `tasks/inbox/`
- a GitHub issue
- a GitHub pull request

For local work, start from:

- `templates/agent-task.json`

### 2. Normalize the task

Convert the raw task into the canonical `AgentTaskSpec` format:

```powershell
npm run agents:normalize -- --input tasks/inbox/<task-file>.json
```

This writes a normalized task into:

- `tasks/ready/`

### 3. Generate a task packet

```powershell
npm run agents:packet -- --task tasks/ready/<normalized-task>.json
```

This produces the packet and execution manifest used by contributors or external agents.

### 4. Split work only when the write scopes are clean

If the task needs parallel execution:

- assign one owned write scope per subtask
- assign a role
- assign the required skills
- use Git worktrees

Allocate worktrees with:

```powershell
node scripts/agents/allocate-worktree.mjs --task <task-json> --subtask <subtask-id>
```

If two subtasks need the same files, the task is not ready for parallel execution yet.

### 5. Use the assigned skills

The skill library is the repo's canonical execution layer.

Canonical skills live in:

- `docs/agents/skills/`

Tool-specific adapters in:

- `.codex/`
- `.claude/`
- `.vscode/`

must not fork behavior. They only provide environment-specific wiring.

### 6. Run validation before handoff

At minimum, use the validation commands declared in the task.

Common commands:

```powershell
npm test
npm run build
npm run test:e2e -- --reporter=line
```

If your change touches terminal lifecycle, repo transition, or practice sandbox behavior, treat it as terminal-sensitive work and include:

- `terminal-integration`
- `playwright-e2e-debugging`

Do not merge that class of change without rerunning the terminal e2e flow.

### 7. Produce a handoff

Every contributor or agent should leave a handoff that records:

- task id
- role
- files changed
- validations run
- outcomes
- assumptions
- risks
- next steps

For batch rollups, use:

```powershell
node scripts/agents/collect-handoff.mjs --handoff-dir <handoff-dir>
```

## Roles, skills, and playbooks

Use the repo docs instead of inventing your own workflow:

- roles: `docs/agents/roles/`
- skills: `docs/agents/skills/`
- playbooks: `docs/agents/playbooks/`

Use them like this:

- role = responsibility
- skill = how to do the work in this repo
- playbook = broader execution sequence

Example:

- role: `implementer`
- skills:
  - `terminal-integration`
  - `playwright-e2e-debugging`
- playbook: `bug-fix`

## GitHub workflow

GitHub templates and workflows are part of the contributor system:

- issue templates: `.github/ISSUE_TEMPLATE/`
- PR template: `.github/PULL_REQUEST_TEMPLATE.md`
- workflows: `.github/workflows/`

PRs are expected to include:

- task id
- acceptance criteria
- validation evidence
- agent handoff summary

## Guardrails

These are repo rules, not suggestions:

- every meaningful change should map to a task id
- every task must declare owned paths
- every code-changing task must declare validation commands
- tool adapters must not fork canonical skill behavior
- evidence must be separated from recommendation or opinion

## Validation commands

Use these to verify the contributor system itself:

```powershell
npm run agents:check
npm test
npm run build
```

`npm run agents:check` validates:

- canonical skill registry pointers
- tool adapter policy and presence
- task artifacts
- PR template headings

## When adding new skills or workflows

If you notice repeated work patterns, encode them once instead of relying on memory or prompt reuse.

Add or update:

- canonical skill docs in `docs/agents/skills/`
- adapters only if a tool genuinely needs metadata or wiring changes
- tests or validation rules if the new workflow adds enforceable behavior

Do not create tool-specific behavior forks unless there is a strong and explicit reason.

## Quick checklist

Before opening a PR:

- task exists and is normalized
- owned paths are clear
- correct role and skills were used
- validation commands were run
- PR template sections are complete
- handoff summary is included

If the task is large:

- execution manifest exists
- work scopes do not overlap
- merge order is clear
