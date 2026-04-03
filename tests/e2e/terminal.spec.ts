import path from "node:path";
import { test, expect, _electron as electron } from "@playwright/test";
import electronBinary from "electron";

const workspaceRoot = path.resolve(__dirname, "..", "..");
const desktopShellRoot = path.join(workspaceRoot, "apps", "desktop-shell");

test("embedded terminal accepts keyboard input and shows shell output", async () => {
  const electronApp = await electron.launch({
    executablePath: electronBinary as unknown as string,
    args: [path.join(desktopShellRoot, "dist-electron", "main.js")],
    cwd: desktopShellRoot,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "ELECTRON_RUN_AS_NODE"))
  });

  try {
    const page = await electronApp.firstWindow();

    await page.getByRole("button", { name: "Create Practice Repo" }).click();
    await expect(page.getByRole("heading", { name: "Git structure explorer" })).toBeVisible();
    await expect(page.locator(".graph-topbar__meta-pill strong").first()).toContainText(/git-observatory-practice/i);
    await page.locator("button").filter({ hasText: /Show Terminal|Hide Terminal/ }).first().click();
    await expect(page.locator(".graph-terminal-drawer")).not.toHaveClass(/is-collapsed/);

    const terminalHost = page.locator(".go-terminal-host");
    await expect(terminalHost).toBeVisible();
    await terminalHost.click({ force: true });
    const terminalInput = page.locator(".xterm-helper-textarea");
    await expect(terminalInput).toBeAttached();
    await terminalInput.click({ force: true });

    await terminalInput.type("pwd");
    await terminalInput.press("Enter");

    const probe = page.getByTestId("terminal-output-probe");
    await expect(probe).toContainText("pwd");
    await expect(probe).toContainText("git-observatory-practice");
  } finally {
    await electronApp.close();
  }
});
