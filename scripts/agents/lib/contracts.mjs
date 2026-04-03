import path from "node:path";
import { promises as fs } from "node:fs";

export const taskSchemaPath = path.resolve(".agents/contracts/agent-task.schema.json");
export const handoffSchemaPath = path.resolve(".agents/contracts/agent-handoff.schema.json");
export const executionManifestSchemaPath = path.resolve(".agents/contracts/execution-manifest.schema.json");
export const recommendationReportSchemaPath = path.resolve(".agents/contracts/recommendation-report.schema.json");
export const skillsRegistryPath = path.resolve(".agents/skills-index.json");

function asArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== undefined);
  }
  if (value === null || value === undefined || value === "") {
    return [];
  }
  return [value];
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function normalizeAgentTaskSpec(input, sourceOverride) {
  const goal = String(input.goal ?? "").trim();
  if (!goal) {
    throw new Error("Task spec requires a non-empty goal.");
  }

  const id =
    String(input.id ?? "").trim() ||
    `${new Date().toISOString().slice(0, 10)}-${slugify(goal).slice(0, 24)}`;
  const source = sourceOverride ?? input.source ?? { kind: "local-task", value: "manual" };
  const scope = asArray(input.scope).map((item) => String(item));
  const nonGoals = asArray(input.nonGoals).map((item) => String(item));
  const ownedPaths = asArray(input.ownedPaths).map((item) => String(item));
  const acceptanceCriteria = asArray(input.acceptanceCriteria).map((item) => String(item));
  const validationCommands = asArray(input.validationCommands).map((item) => String(item));
  const dependencies = asArray(input.dependencies).map((item) => String(item));
  const recommendedSkills = asArray(input.recommendedSkills).map((item) => String(item));
  const parallelWorkstreams = asArray(input.parallelWorkstreams).map((item, index) => ({
    id: String(item.id ?? `${id}-stream-${index + 1}`),
    goal: String(item.goal ?? goal),
    role: String(item.role ?? input.recommendedRole ?? "implementer"),
    ownedPaths: asArray(item.ownedPaths ?? ownedPaths).map((value) => String(value)),
    recommendedSkills: asArray(item.recommendedSkills ?? recommendedSkills).map((value) => String(value)),
    validationCommands: asArray(item.validationCommands ?? validationCommands).map((value) => String(value)),
    acceptanceCriteria: asArray(item.acceptanceCriteria ?? acceptanceCriteria).map((value) => String(value))
  }));

  return {
    id,
    source,
    goal,
    scope,
    nonGoals,
    ownedPaths,
    acceptanceCriteria,
    validationCommands,
    dependencies,
    recommendedRole: String(input.recommendedRole ?? "implementer"),
    recommendedSkills,
    context: String(input.context ?? "").trim(),
    parallelWorkstreams,
    metadata: {
      priority: String(input.metadata?.priority ?? "medium"),
      labels: asArray(input.metadata?.labels).map((item) => String(item))
    }
  };
}

export function normalizeGitHubTaskSpec(eventPayload) {
  if (eventPayload.issue) {
    const issue = eventPayload.issue;
    return normalizeAgentTaskSpec(
      {
        id: `gh-issue-${issue.number}`,
        goal: issue.title,
        context: issue.body ?? "",
        scope: [`Resolve GitHub issue #${issue.number}`],
        nonGoals: [],
        ownedPaths: [],
        acceptanceCriteria: ["Match the GitHub issue intent.", "Document validations in the handoff."],
        validationCommands: ["npm test", "npm run build"],
        recommendedRole: "implementer",
        recommendedSkills: ["repo-map", "workspace-commands"],
        metadata: {
          priority: "medium",
          labels: (issue.labels ?? []).map((label) => (typeof label === "string" ? label : label.name))
        }
      },
      {
        kind: "github-issue",
        value: issue.html_url
      }
    );
  }

  if (eventPayload.pull_request) {
    const pullRequest = eventPayload.pull_request;
    return normalizeAgentTaskSpec(
      {
        id: `gh-pr-${pullRequest.number}`,
        goal: pullRequest.title,
        context: pullRequest.body ?? "",
        scope: [`Review or continue GitHub pull request #${pullRequest.number}`],
        nonGoals: [],
        ownedPaths: [],
        acceptanceCriteria: ["Preserve the PR intent.", "Document validations in the handoff."],
        validationCommands: ["npm test", "npm run build"],
        recommendedRole: "reviewer",
        recommendedSkills: ["repo-map", "test-gap-analysis"],
        metadata: {
          priority: "medium",
          labels: []
        }
      },
      {
        kind: "github-pr",
        value: pullRequest.html_url
      }
    );
  }

  throw new Error("GitHub event payload does not contain an issue or pull_request object.");
}

export function createExecutionManifest(taskSpec) {
  const streams = taskSpec.parallelWorkstreams.length > 0
    ? taskSpec.parallelWorkstreams
    : [
        {
          id: `${taskSpec.id}-default`,
          goal: taskSpec.goal,
          role: taskSpec.recommendedRole,
          ownedPaths: taskSpec.ownedPaths,
          recommendedSkills: taskSpec.recommendedSkills,
          validationCommands: taskSpec.validationCommands,
          acceptanceCriteria: taskSpec.acceptanceCriteria
        }
      ];

  return {
    taskId: taskSpec.id,
    planner: "planner",
    generatedAt: new Date().toISOString(),
    mergeOrder: streams.map((stream) => stream.id),
    subtasks: streams.map((stream) => ({
      id: stream.id,
      role: stream.role,
      goal: stream.goal,
      ownedPaths: stream.ownedPaths,
      recommendedSkills: stream.recommendedSkills,
      validationCommands: stream.validationCommands,
      acceptanceCriteria: stream.acceptanceCriteria
    }))
  };
}

export function renderHandoffMarkdown(handoff) {
  return [
    `# Agent Handoff: ${handoff.taskId}`,
    "",
    `- Role: ${handoff.role}`,
    `- Files changed: ${handoff.filesChanged.join(", ") || "(none)"}`,
    `- Validation: ${handoff.validationsRun.join(", ") || "(none)"}`,
    "",
    "## Outcomes",
    ...handoff.outcomes.map((item) => `- ${item}`),
    "",
    "## Assumptions",
    ...handoff.assumptions.map((item) => `- ${item}`),
    "",
    "## Risks",
    ...handoff.risks.map((item) => `- ${item}`),
    "",
    "## Next Steps",
    ...handoff.nextSteps.map((item) => `- ${item}`),
    ""
  ].join("\n");
}

export function buildRecommendationReport(tasks) {
  const readyTasks = tasks.filter((task) => task.bucket === "ready");
  const scored = readyTasks
    .map((task) => ({
      id: task.id,
      goal: task.goal,
      impact: task.ownedPaths.length > 0 ? "medium" : "high",
      confidence: task.validationCommands.length > 0 ? 0.82 : 0.61
    }))
    .sort((left, right) => right.confidence - left.confidence);

  return {
    category: "next-best-task",
    generatedAt: new Date().toISOString(),
    evidence: scored.map((task) => ({
      id: task.id,
      goal: task.goal,
      impact: task.impact,
      confidence: task.confidence
    })),
    recommendation: scored[0] ?? null
  };
}

export async function loadSkillsRegistry() {
  return readJson(skillsRegistryPath);
}

export async function validateRegistryFiles(registry) {
  const missing = [];
  const checkedAdapters = new Set();

  for (const skill of registry.skills) {
    const canonicalPath = path.resolve(skill.canonicalPath);
    try {
      await fs.access(canonicalPath);
    } catch {
      missing.push(`Missing canonical skill: ${skill.id} -> ${skill.canonicalPath}`);
    }

    for (const [toolName, adapterPath] of Object.entries(skill.adapters ?? {})) {
      const resolved = path.resolve(adapterPath);
      try {
        await fs.access(resolved);
        if (!checkedAdapters.has(resolved) && resolved.endsWith(".json")) {
          checkedAdapters.add(resolved);
          const adapter = JSON.parse(await fs.readFile(resolved, "utf8"));
          if (adapter.canonicalRegistry !== ".agents/skills-index.json") {
            missing.push(
              `Invalid ${toolName} adapter registry pointer for ${skill.id}: ${adapterPath}`
            );
          }
          if (adapter.overridePolicy !== "adapter-only") {
            missing.push(
              `Invalid ${toolName} adapter override policy for ${skill.id}: ${adapterPath}`
            );
          }
        }
      } catch {
        missing.push(`Missing ${toolName} adapter for ${skill.id}: ${adapterPath}`);
      }
    }
  }

  return missing;
}

export function validatePullRequestBody(body) {
  const requiredHeadings = [
    "## Task ID",
    "## Acceptance Criteria",
    "## Validation",
    "## Agent Handoff"
  ];

  return requiredHeadings.filter((heading) => !body.includes(heading));
}
