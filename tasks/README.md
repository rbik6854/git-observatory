# Tasks

This repository supports both local task intake and GitHub-backed task intake.

## Directories

- `tasks/inbox`
  - raw local tasks that still need normalization or triage
- `tasks/ready`
  - normalized `AgentTaskSpec` files that are safe to hand to agents
- `tasks/done`
  - completed handoffs and rollups
- `tasks/recommendations`
  - evidence-backed recommendation reports

## Typical flow

1. Copy `templates/agent-task.json` into `tasks/inbox/`.
2. Run `npm run agents:normalize -- --input tasks/inbox/<file>.json`.
3. Run `npm run agents:packet -- --task tasks/ready/<file>.json`.
4. Allocate worktrees for subtasks if parallel work is needed.
5. Collect handoffs into `tasks/done/`.
