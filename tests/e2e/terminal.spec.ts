import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { test, expect, _electron as electron } from "@playwright/test";
import electronBinary from "electron";

const workspaceRoot = path.resolve(__dirname, "..", "..");
const desktopShellRoot = path.join(workspaceRoot, "apps", "desktop-shell");

test("playground shell creates a repo without embedded terminal UI", async () => {
  const electronApp = await electron.launch({
    executablePath: electronBinary as unknown as string,
    args: [path.join(desktopShellRoot, "dist-electron", "main.js")],
    cwd: desktopShellRoot,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "ELECTRON_RUN_AS_NODE"))
  });

  try {
    const page = await electronApp.firstWindow();

    await expect(page.getByRole("heading", { name: "Git Playground" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Playground" })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`Open ${"Repo"}`, "i") })).toHaveCount(0);
    await expect(page.getByText(/terminal/i)).toHaveCount(0);

    await page.getByRole("button", { name: "New Playground" }).click();

    await expect(page.getByRole("heading", { name: "Git Playground" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Open System Terminal" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Playground" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset Playground" })).toHaveCount(0);
    await expect(page.locator(".go-graph-scroll")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Working Tree" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Index" })).toBeVisible();
    await expect(page.locator(`.go-${"terminal"}-host`)).toHaveCount(0);
    await expect(page.locator(".graph-terminal-drawer")).toHaveCount(0);
  } finally {
    await electronApp.close();
  }
});

test("playground canvas expands committed tree contents after refresh", async () => {
  const electronApp = await electron.launch({
    executablePath: electronBinary as unknown as string,
    args: [path.join(desktopShellRoot, "dist-electron", "main.js")],
    cwd: desktopShellRoot,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "ELECTRON_RUN_AS_NODE"))
  });

  try {
    const page = await electronApp.firstWindow();

    await page.getByRole("button", { name: "New Playground" }).click();
    const repoPath = (await page.locator(".playground-path").textContent({ timeout: 30000 }))?.trim();
    if (!repoPath) {
      throw new Error("Playground path was not rendered.");
    }

    execFileSync("git", ["init"], { cwd: repoPath });
    execFileSync("git", ["config", "user.name", "Playground Test"], { cwd: repoPath });
    execFileSync("git", ["config", "user.email", "playground@example.test"], { cwd: repoPath });
    writeFileSync(path.join(repoPath, "test.txt"), "hello\n");
    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.locator(".playground-state-panel").filter({ hasText: "Working Tree" })).toContainText("test.txt");
    await expect(page.locator(".playground-state-panel").filter({ hasText: "Working Tree" })).toContainText("untracked");
    await expect(page.locator(".playground-state-panel").filter({ hasText: "Index" })).toContainText("No staged paths");

    execFileSync("git", ["add", "test.txt"], { cwd: repoPath });
    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.locator(".playground-state-panel").filter({ hasText: "Index" })).toContainText("test.txt");
    await expect(page.locator(".playground-state-panel").filter({ hasText: "Index" })).toContainText("staged new file");

    execFileSync("git", ["commit", "-m", "first commit"], { cwd: repoPath });

    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.locator(".go-node--blob")).toContainText("test.txt");
    await expect(page.locator(".go-graph-edge--contains")).toHaveCount(2);
    await expect(page.locator(".go-node__badge--staged")).toHaveCount(0);
    await expect(page.locator(".go-node--head")).toHaveCount(0);
    await expect(page.locator(".go-node--ref")).toHaveCount(0);
    await expect(page.locator(".go-node__ref-badge")).toContainText(["main *", "HEAD"]);

    writeFileSync(path.join(repoPath, "test.txt"), "hello again\n");
    writeFileSync(path.join(repoPath, "removed.txt"), "remove me\n");
    execFileSync("git", ["add", "removed.txt"], { cwd: repoPath });
    execFileSync("git", ["commit", "-m", "add removed file"], { cwd: repoPath });
    unlinkSync(path.join(repoPath, "removed.txt"));
    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.locator(".playground-state-panel").filter({ hasText: "Working Tree" })).toContainText("test.txt");
    await expect(page.locator(".playground-state-panel").filter({ hasText: "Working Tree" })).toContainText("modified");
    await expect(page.locator(".playground-state-panel").filter({ hasText: "Working Tree" })).toContainText("removed.txt");
    await expect(page.locator(".playground-state-panel").filter({ hasText: "Working Tree" })).toContainText("deleted");

    execFileSync("git", ["add", "test.txt", "removed.txt"], { cwd: repoPath });
    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.locator(".playground-state-panel").filter({ hasText: "Index" })).toContainText("test.txt");
    await expect(page.locator(".playground-state-panel").filter({ hasText: "Index" })).toContainText("staged modified");
    await expect(page.locator(".playground-state-panel").filter({ hasText: "Index" })).toContainText("removed.txt");
    await expect(page.locator(".playground-state-panel").filter({ hasText: "Index" })).toContainText("staged delete");
  } finally {
    await electronApp.close();
  }
});

test("new playground creates a separate repo and all session repos are cleaned on exit", async () => {
  const electronApp = await electron.launch({
    executablePath: electronBinary as unknown as string,
    args: [path.join(desktopShellRoot, "dist-electron", "main.js")],
    cwd: desktopShellRoot,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "ELECTRON_RUN_AS_NODE"))
  });

  let firstRepoPath = "";
  let secondRepoPath = "";

  const page = await electronApp.firstWindow();
  await page.getByRole("button", { name: "New Playground" }).click();
  firstRepoPath = (await page.locator(".playground-path").textContent({ timeout: 30000 }))?.trim() ?? "";

  await page.getByRole("button", { name: "New Playground" }).click();
  secondRepoPath = (await page.locator(".playground-path").textContent({ timeout: 30000 }))?.trim() ?? "";

  expect(firstRepoPath).not.toBe("");
  expect(secondRepoPath).not.toBe("");
  expect(secondRepoPath).not.toBe(firstRepoPath);
  expect(existsSync(firstRepoPath)).toBe(true);
  expect(existsSync(secondRepoPath)).toBe(true);

  await electronApp.close();

  expect(existsSync(firstRepoPath)).toBe(false);
  expect(existsSync(secondRepoPath)).toBe(false);
});
