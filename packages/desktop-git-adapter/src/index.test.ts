import { afterEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { LocalGitExecutionAdapter } from "./index";

const cleanupTargets: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupTargets.splice(0).map(async (target) => {
      await fs.rm(target, { recursive: true, force: true });
    })
  );
});

describe("LocalGitExecutionAdapter.createSandbox", () => {
  it("creates a sandbox inside the provided app-owned root and returns descriptor metadata", async () => {
    const adapter = new LocalGitExecutionAdapter();
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "git-observatory-test-"));
    cleanupTargets.push(root);

    const result = await adapter.createSandbox("learning", root, "session-123", "lesson");

    expect(result.sandbox.kind).toBe("learning");
    expect(result.sandbox.sessionId).toBe("session-123");
    expect(result.repoPath.startsWith(root)).toBe(true);
    await expect(fs.access(result.repoPath)).resolves.toBeUndefined();
  });
});
