# Example: Adding a New Feature with the Agent Workflow

This example shows how a developer should use the agent-first contributor system to add a new feature from end to end.

The example feature is:

- add a `Fit Graph` action that re-centers and zooms the Git structure canvas so all visible nodes are in view

This is a good example because it touches:

- renderer UI
- shared graph UI components
- possibly graph projection data
- validation and user-visible behavior

## What the developer wants

The developer's intent is:

- add a new user-visible feature
- keep the graph readable after large repo changes
- implement it safely using the repo's agent workflow

The point of this example is not just "what files to change."

It is:

- what artifact to create first
- how to express the work so agents can execute it correctly
- how the repo internally turns that request into a merge-safe workflow

## Step 1: Create the task

The developer starts by creating a local task file in:

- `tasks/inbox/fit-graph-feature.json`

A reasonable task file would look like this:

```json
{
  "goal": "Add a Fit Graph action that re-centers and zooms the visible Git canvas.",
  "scope": [
    "Add a visible UI action for fitting the graph to the viewport.",
    "Wire the action to the current graph canvas.",
    "Keep the behavior available after repo refreshes."
  ],
  "nonGoals": [
    "Do not redesign the entire graph toolbar.",
    "Do not rewrite the graph layout engine."
  ],
  "ownedPaths": [
    "apps/desktop-shell/src/renderer",
    "packages/ui-shared/src"
  ],
  "acceptanceCriteria": [
    "A user can trigger Fit Graph from the desktop app.",
    "The graph re-centers to the visible node set.",
    "The feature does not break existing graph interactions."
  ],
  "validationCommands": [
    "npm test",
    "npm run build"
  ],
  "recommendedRole": "implementer",
  "recommendedSkills": [
    "repo-map",
    "graph-layout-changes",
    "workspace-commands"
  ],
  "context": "The current graph can drift off screen after repo growth or repeated interactions.",
  "metadata": {
    "priority": "medium",
    "labels": [
      "feature",
      "graph"
    ]
  }
}
```

## Why this task file matters

This is where the developer makes the work executable.

The task file tells the system:

- what the goal is
- what is in scope
- what is explicitly out of scope
- which paths the agent is allowed to edit
- how success will be measured
- what validations are required
- which skills should govern execution

Without this file, an agent only has an idea. With this file, it has a bounded contract.

## Step 2: Normalize the task

The developer runs:

```powershell
npm run agents:normalize -- --input tasks/inbox/fit-graph-feature.json
```

This creates a normalized task in:

- `tasks/ready/`

## What happens internally

Internally, `scripts/agents/normalize-task.mjs` does three things:

1. reads the raw task JSON
2. validates and normalizes it through `normalizeAgentTaskSpec`
3. writes the canonical `AgentTaskSpec`

That normalization step ensures the task has a stable shape:

- arrays are normalized
- defaults are filled in
- the role and metadata are explicit
- the task is safe for downstream tooling

This is important because Codex, Claude Code, and VS Code integrations should all consume the same canonical task artifact.

## Step 3: Decide whether to split the work

For this example, the developer has two choices.

### Option A: Keep it as one implementation task

If the feature is small, they can keep it as one task:

- role: `implementer`
- skills:
  - `repo-map`
  - `graph-layout-changes`
  - `workspace-commands`

### Option B: Split into parallel subtasks

If the feature is larger, they could split it like this:

- subtask 1
  - goal: add the toolbar action and renderer wiring
  - owned paths:
    - `apps/desktop-shell/src/renderer`
- subtask 2
  - goal: add shared graph canvas fit behavior
  - owned paths:
    - `packages/ui-shared/src`

That is valid parallelism because the write scopes are clean.

It would not be valid to create two subtasks that both modify the same graph component files unless there is an explicit merge strategy.

## Step 4: Generate the task packet

The developer runs:

```powershell
npm run agents:packet -- --task tasks/ready/<normalized-task>.json
```

## What happens internally

Internally, `scripts/agents/create-task-packet.mjs` reads the normalized task and creates an `ExecutionManifest`.

If the task has no explicit parallel workstreams:

- the system creates a single default subtask

If the task defines parallel workstreams:

- the manifest records each subtask
- roles
- owned paths
- skills
- validation commands
- merge order

This matters because the execution manifest is what turns a task into a safe multi-agent plan.

## Step 5: Allocate worktrees if the task is parallel

If the developer split the feature, they allocate one worktree per subtask:

```powershell
node scripts/agents/allocate-worktree.mjs --task tasks/ready/<normalized-task>.json --subtask <subtask-id>
```

## What happens internally

The script creates:

- a dedicated branch
- a dedicated worktree under `.agent-worktrees/`

This gives each agent an isolated workspace.

Why that matters:

- the renderer-focused agent can change toolbar wiring without colliding with the graph-canvas agent
- merge order stays explicit
- review is easier because each subtask has one purpose

## Step 6: Run the assigned agent using the declared skills

Now the developer launches the agent in their preferred environment.

Example assignment:

- role: `implementer`
- skills:
  - `repo-map`
  - `graph-layout-changes`
  - `workspace-commands`

## What the agent should do

The agent should:

1. read the task packet
2. confirm the owned paths
3. read the assigned skills from `docs/agents/skills/`
4. inspect the repo map if boundaries are unclear
5. implement the feature only within the allowed write scope
6. run the required validations
7. produce a handoff

## What happens internally

The key internal mechanism here is the skill system.

For example:

- `repo-map`
  - makes the agent confirm where the feature belongs before editing
- `graph-layout-changes`
  - tells the agent how this repo expects graph/UI changes to be made
- `workspace-commands`
  - tells the agent which validations to run and how to stay aligned with repo commands

This is the difference between an agent improvising and an agent operating inside a controlled repo system.

## Step 7: Validate the feature

The developer or agent runs the task's required commands:

```powershell
npm test
npm run build
```

If the feature also needed end-to-end verification, the task could include:

```powershell
npm run test:e2e -- --reporter=line
```

## What happens internally

Validation is not a courtesy step. It is part of the task contract.

The contributor system expects:

- validations are declared in the task
- validations are run before handoff
- validation evidence is surfaced in the PR and handoff

That is what makes agent output reviewable instead of opaque.

## Step 8: Produce the handoff

After implementation, the agent produces an `AgentHandoff`.

A good handoff for this example would include:

- task id
- role: `implementer`
- files changed
- validations run
- outcomes
- assumptions
- risks
- next steps

Example outcome notes:

- added Fit Graph action to the graph toolbar
- wired the action to the canvas viewport controller
- preserved existing zoom and pan interactions

Example risk notes:

- large repos may still need viewport padding tuning

## What happens internally

The handoff is what lets:

- reviewers evaluate the change quickly
- testers understand what was actually verified
- later agents pick up follow-up work without re-discovering context

For parallel tasks, multiple handoffs can be combined with:

```powershell
node scripts/agents/collect-handoff.mjs --handoff-dir <handoff-dir>
```

## Step 9: Review and merge

For a single-task feature:

- the reviewer checks the task id
- confirms acceptance criteria
- confirms validations
- checks the handoff

For a parallel feature:

- merge order follows the execution manifest
- each subtask is reviewed in scope
- the combined feature is validated at the end

## How this differs from a normal ad hoc coding flow

Without the agent system, the process is usually:

- someone describes a feature informally
- an agent or contributor interprets it loosely
- code changes happen
- validation and scope are inconsistent

With this system, the process is:

1. declare the task
2. normalize it
3. optionally split it cleanly
4. assign role and skills
5. validate against explicit commands
6. produce a handoff

This is slower at the very start, but much safer for:

- parallel execution
- external agent environments
- review quality
- long-term contributor consistency

## Summary of the internal pipeline

For this one feature, the internal repo pipeline is:

1. raw developer intent
2. local task file in `tasks/inbox/`
3. normalized `AgentTaskSpec` in `tasks/ready/`
4. generated `ExecutionManifest`
5. optional worktree allocation
6. agent execution using canonical skills
7. validation commands
8. `AgentHandoff`
9. review and merge

That is the intended operating model for new feature work in this repo.

## Recommended takeaway for developers

If you want to add a feature, do not start by telling an agent "go build X."

Start by defining:

- the task
- the scope
- the owned paths
- the acceptance criteria
- the validation commands
- the required skills

Once that is done, the rest of the system works predictably.
