import { describe, expect, it } from "vitest";
import { interactiveLessonSteps, lessonChapters } from "./index";

describe("lessonChapters", () => {
  it("starts with a self-contained beginner flow", () => {
    expect(interactiveLessonSteps.map((step) => step.id)).toEqual([
      "step-init-repository",
      "step-create-readme",
      "step-stage-readme",
      "step-commit-readme"
    ]);
  });

  it("defines the full chapter roadmap", () => {
    expect(lessonChapters).toHaveLength(10);
    expect(lessonChapters[0]?.title).toContain("Git Creates a Repository");
    expect(lessonChapters[9]?.title).toContain("Git Optimizes Storage");
  });
});
