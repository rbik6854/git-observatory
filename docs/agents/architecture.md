# AI Contributor Architecture

This repository is set up so external agentic coding environments can work against one shared system instead of each tool inventing its own workflow.

The design goal is simple:

- one canonical task model
- one canonical skill library
- one set of repo guardrails
- thin adapters for Codex, Claude Code, and VS Code

The result is a repo that is agent-friendly without becoming tool-locked.

## Core principles

### 1. Canonical first

All behavior lives in repo-owned canonical files:

- task and handoff contracts: `.agents/contracts/`
- canonical skill bodies: `docs/agents/skills/`
- roles and playbooks: `docs/agents/roles/`, `docs/agents/playbooks/`
- shared skill registry: `.agents/skills-index.json`

Tool-specific directories are adapters only:

- `.codex/`
- `.claude/`
- `.vscode/`

Those adapter files may change:

- metadata
- file location
- invocation wiring

They may not change:

- workflow steps
- validation expectations
- output semantics
- acceptance expectations

### 2. Task-driven execution

Agents do not start from ad hoc prompts alone. They start from a normalized task artifact.

Every meaningful agent contribution should map to an `AgentTaskSpec`.

That keeps work reviewable, bounded, and automatable.

### 3. Skills are the reusable execution layer

Roles answer "who is doing the work."

Tasks answer "what should be done."

Skills answer "how this repo expects the work to be done."

That is what makes parallel agents consistent instead of prompt-fragile.

### 4. Parallel work must be merge-safe

When a task is split, each subtask gets:

- one owned write scope
- one role
- one or more skills
- one validation command set
- one required handoff

Parallel work should use Git worktrees by default.

## Main building blocks

### Canonical contracts

Canonical schemas live in `.agents/contracts/`.

They define:

- `AgentTaskSpec`
  - the normalized task format for local or GitHub-backed work
- `AgentHandoff`
  - the required output structure from any agent
- `ExecutionManifest`
  - the planner's decomposition of a task into subtasks
- `RecommendationReport`
  - the structured output for recommendation and analysis work

These contracts are the backbone of the system.

### Canonical skills

Canonical skills live in `docs/agents/skills/`.

Each skill uses the same structure:

- `Purpose`
- `Use when`
- `Do not use when`
- `Inputs needed`
- `Relevant paths`
- `Workflow`
- `Validation`
- `Output format`
- `Common mistakes`

That standardization matters. It means:

- humans can read them quickly
- agents can follow them predictably
- adapters can point to them without behavior drift

### Roles

Roles live in `docs/agents/roles/`.

Current roles are:

- `planner`
- `implementer`
- `reviewer`
- `tester`
- `researcher`
- `ux-auditor`
- `recommender`

Roles do not replace skills. They work together:

- role = responsibility
- skill = workflow

### Playbooks

Playbooks live in `docs/agents/playbooks/`.

They standardize recurring workflows such as:

- feature work
- bug fixes
- repo analysis
- feature recommendation
- UX review
- performance triage

Playbooks are the higher-level operating procedures that combine tasks, roles, and skills.

### Tool adapters

Tool adapters live in:

- `.codex/`
- `.claude/`
- `.vscode/`

They exist so the same repo system can be consumed by different agentic environments without forking the logic.

The adapter rule is strict:

- adapter files may point to the canonical registry
- adapter files may express tool-specific metadata
- adapter files must not redefine the workflow behavior

### Automation and task scripts

Repo-managed scripts live in `scripts/agents/`.

They handle:

- task normalization
- task packet creation
- worktree allocation
- handoff collection
- worktree cleanup
- recommendation generation
- adapter validation
- PR body validation

This gives the repo a usable orchestration layer without requiring a heavyweight internal agent platform.

## How the system works step by step

This is the intended lifecycle for agent-driven work.

### Step 1: Intake

Work starts from either:

- a local task JSON in `tasks/inbox/`
- a GitHub issue
- a GitHub pull request

Local tasks use `templates/agent-task.json` as the starting point.

GitHub-backed tasks are normalized from the event payload by:

- `scripts/agents/normalize-task.mjs`

### Step 2: Normalization

The raw task is transformed into a normalized `AgentTaskSpec`.

That normalized artifact is stored under:

- `tasks/ready/`

The normalized task establishes:

- goal
- scope
- non-goals
- owned paths
- acceptance criteria
- validation commands
- recommended role
- recommended skills

This is where fuzzy requests become executable work.

### Step 3: Planning

If the work is large enough to split, a planner produces an `ExecutionManifest`.

That manifest lists:

- subtasks
- roles
- owned write scopes
- required skills
- validation commands
- merge order

If no split is needed, the system creates a default single-subtask manifest.

### Step 4: Worktree allocation

For parallel tasks, each subtask gets its own Git worktree.

That is done via:

- `scripts/agents/allocate-worktree.mjs`

Why worktrees matter:

- agents can work in parallel safely
- write scopes stay isolated
- merge risk is reduced

### Step 5: Agent execution

The agent receives:

- the normalized task or subtask packet
- the assigned role
- the required skills
- the owned write scope
- the validation commands

The agent then performs the task following the repo rules instead of improvising its own workflow.

### Step 6: Validation

Before handoff, the assigned validation commands must be run.

Typical commands:

- `npm test`
- `npm run build`
- `npm run test:e2e -- --reporter=line`

Not every task needs every command. The task defines the required validation set.

### Step 7: Handoff

Every agent produces an `AgentHandoff`.

That handoff records:

- task id
- role
- files changed
- validations run
- outcomes
- assumptions
- risks
- next steps

This is what makes agent output reviewable.

### Step 8: Merge and follow-up

For multi-agent work, merge order follows the `ExecutionManifest`.

Completed rollups can be collected via:

- `scripts/agents/collect-handoff.mjs`

That produces a consolidated summary in `tasks/done/`.

## Skills architecture in detail

### Why canonical skills exist

Without canonical skills, each agent environment ends up relying on custom prompts and tribal knowledge.

That leads to:

- inconsistent workflows
- repeated mistakes
- tool-specific behavior drift
- poor onboarding for new contributors

Canonical skills solve that by encoding repo-specific operating knowledge once.

### How a skill should be used

An agent should:

1. identify the assigned skill
2. read the skill file in `docs/agents/skills/`
3. follow the workflow and validation steps in that file
4. produce output in the required format

The skill is not a suggestion. It is the expected method for recurring work patterns in this repo.

### Skills versus playbooks versus roles

They are related but not interchangeable.

- `Role`
  - defines responsibility
- `Skill`
  - defines task-specific workflow
- `Playbook`
  - defines the broader sequence across tasks or roles

Example:

- role: `implementer`
- skill: `terminal-integration`
- playbook: `bug-fix`

That combination tells the agent:

- what responsibility it holds
- how to do the work correctly
- how the overall workflow should progress

### How adapters use skills

Codex, Claude Code, and VS Code should all reference the same canonical skill.

If a tool needs a local file for discovery or integration, that file should:

- point to the canonical registry
- add only tool-specific metadata

It should not fork the behavior.

## Developer workflow

This is the recommended way for contributors to use the system.

### For a local task

1. Copy `templates/agent-task.json` to `tasks/inbox/<task-name>.json`.
2. Fill in:
   - goal
   - scope
   - non-goals
   - owned paths
   - acceptance criteria
   - validation commands
   - recommended role
   - recommended skills
3. Normalize it:
   - `npm run agents:normalize -- --input tasks/inbox/<task-name>.json`
4. Generate a task packet:
   - `npm run agents:packet -- --task tasks/ready/<normalized-file>.json`
5. If needed, allocate worktrees for subtasks.
6. Run the assigned agent or agents against that packet.
7. Collect handoffs into `tasks/done/`.

### For a GitHub issue or PR

1. Open or update the issue or PR using the repo templates.
2. Let GitHub Actions normalize the event into a task artifact.
3. Use the generated task as the source of truth for agent execution.
4. Require the PR template sections to be completed before merge.

### For parallel work

1. Create or review the execution manifest.
2. Ensure each subtask has:
   - non-overlapping owned paths
   - role
   - required skills
   - validation commands
3. Allocate one worktree per subtask.
4. Merge back in manifest order.

## Recommended developer practices

### 1. Treat the task as the contract

If the task is vague, fix the task first. Do not rely on the agent to infer constraints that should have been declared explicitly.

### 2. Assign skills intentionally

Do not dump generic instructions into the task. Use the repo skill library.

Bad:

- "fix the terminal carefully"

Better:

- role: `implementer`
- skills:
  - `terminal-integration`
  - `playwright-e2e-debugging`

### 3. Keep write scopes explicit

If two agents can edit the same files, you do not have real parallelism. You have merge debt.

### 4. Require evidence

Agent output is only as useful as its validation evidence.

Always require:

- commands run
- result of those commands
- risks or unverified areas

### 5. Turn recurring pain into skills

If a bug class or review pattern repeats, encode it as a skill instead of solving it ad hoc every time.

### 6. Treat terminal-sensitive changes as a guarded path

For this repo, terminal regressions have repeated often enough that terminal-adjacent work should not be treated as ordinary renderer polish.

Any task that touches:

- `apps/desktop-shell/src/renderer/App.tsx`
- `apps/desktop-shell/src/main.ts`
- `apps/desktop-shell/src/preload.ts`

in a way that can affect terminal mount, focus, PTY session lifecycle, repo transitions, or practice reset should explicitly include:

- role: `implementer`
- skills:
  - `terminal-integration`
  - `playwright-e2e-debugging`

and should run the terminal e2e coverage before handoff.

## Guardrails and enforcement

The repo enforces this system with:

- task validation scripts
- adapter validation scripts
- PR template validation
- GitHub Actions checks
- unit tests for the contracts

Current command:

- `npm run agents:check`

This validates:

- skill registry pointers
- adapter presence and policy
- local task artifacts
- PR template headings

## Example end-to-end flow

Here is a concrete local flow:

1. A contributor wants to fix a graph overlap bug.
2. They create `tasks/inbox/graph-overlap.json`.
3. They assign:
   - role: `implementer`
   - skills:
     - `repo-map`
     - `graph-layout-changes`
     - `workspace-commands`
4. They normalize the task.
5. They generate the packet.
6. The agent works only in:
   - `packages/core-analysis`
   - `packages/ui-shared`
7. The agent runs:
   - `npm test`
   - `npm run build`
8. The agent produces a handoff.
9. Reviewer or tester picks up the result using the same task id.

That is the expected usage model.

## What this setup is not

This repo is not using a heavyweight custom multi-agent platform.

It is intentionally lighter than that.

The repo provides:

- contracts
- skills
- adapters
- scripts
- CI guardrails

External agentic environments can then plug into that system cleanly.

That keeps the repo portable across tools while still being opinionated enough to work.

## Where to start

If you are new to this system, start here:

1. `docs/agents/README.md`
2. `docs/agents/repo-map.md`
3. `docs/agents/skills/`
4. `templates/agent-task.json`
5. `tasks/README.md`
6. `docs/agents/examples/feature-example.md`

Then run:

- `npm run agents:check`

If that passes, the contributor system is wired correctly in your checkout.
