import path from "node:path";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
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
    await expect(page.locator(".go-graph-scroll")).toBeVisible({ timeout: 30000 });
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
    execFileSync("git", ["add", "test.txt"], { cwd: repoPath });
    execFileSync("git", ["commit", "-m", "first commit"], { cwd: repoPath });

    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.locator(".go-node--blob")).toContainText("test.txt");
    await expect(page.locator(".go-graph-edge--contains")).toHaveCount(2);
  } finally {
    await electronApp.close();
  }
});
