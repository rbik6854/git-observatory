import { describe, expect, it } from "vitest";

const contractsModule = await import("../../scripts/agents/lib/contracts.mjs");

const {
  createExecutionManifest,
  normalizeAgentTaskSpec,
  validatePullRequestBody,
  loadSkillsRegistry
} = contractsModule;

describe("agent contracts", () => {
  it("normalizes a local task with stable defaults", () => {
    const task = normalizeAgentTaskSpec({
      goal: "Fix terminal attach flow",
      scope: "Keep the shell usable after repo creation",
      ownedPaths: "apps/desktop-shell/src/renderer/App.tsx",
      acceptanceCriteria: ["Terminal attaches cleanly"],
      validationCommands: ["npm test"],
      recommendedSkills: "terminal-integration"
    });

    expect(task.goal).toBe("Fix terminal attach flow");
    expect(task.scope).toEqual(["Keep the shell usable after repo creation"]);
    expect(task.ownedPaths).toEqual(["apps/desktop-shell/src/renderer/App.tsx"]);
    expect(task.recommendedRole).toBe("implementer");
    expect(task.metadata.priority).toBe("medium");
  });

  it("creates a default execution stream when no parallel streams are declared", () => {
    const task = normalizeAgentTaskSpec({
      id: "task-1",
      goal: "Improve graph readability",
      ownedPaths: ["packages/core-analysis/src/index.ts"],
      acceptanceCriteria: ["Graph remains readable"],
      validationCommands: ["npm test"],
      recommendedSkills: ["graph-layout-changes"]
    });

    const manifest = createExecutionManifest(task);
    expect(manifest.taskId).toBe("task-1");
    expect(manifest.subtasks).toHaveLength(1);
    expect(manifest.subtasks[0].goal).toBe("Improve graph readability");
    expect(manifest.subtasks[0].recommendedSkills).toEqual(["graph-layout-changes"]);
  });

  it("reports missing PR headings", () => {
    const missing = validatePullRequestBody("## Task ID\n\n- task-1\n");
    expect(missing).toEqual(["## Acceptance Criteria", "## Validation", "## Agent Handoff"]);
  });

  it("loads the canonical skills registry", async () => {
    const registry = await loadSkillsRegistry();
    expect(Array.isArray(registry.skills)).toBe(true);
    expect(registry.skills.length).toBeGreaterThanOrEqual(17);
    expect(registry.skills.some((skill: { id: string }) => skill.id === "terminal-integration")).toBe(true);
  });
});
