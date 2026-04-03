# feature-recommendation

## Purpose
Generate evidence-backed feature recommendations for the product or contributor workflow.

## Use when
- A task asks for new feature ideas, prioritization, or next-best-task guidance.

## Do not use when
- The task is to implement a feature rather than recommend one.

## Inputs needed
- Current pain points
- Ready or inbox tasks if available

## Relevant paths
- `tasks/inbox`
- `tasks/ready`
- `tasks/recommendations`
- `docs/agents/playbooks/feature-recommendation.md`

## Workflow
1. Review task backlog and current product friction.
2. Group ideas by impact and implementation fit.
3. Separate evidence from recommendation.

## Validation
- `npm run agents:recommend`

## Output format
- Recommendation report with evidence, impact, confidence, and next action.

## Common mistakes
- Listing ideas without any repo-grounded evidence.
