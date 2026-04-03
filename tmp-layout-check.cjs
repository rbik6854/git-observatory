const path = require('node:path');
const { _electron: electron } = require('@playwright/test');
const electronBinary = require('electron');
(async () => {
  const workspaceRoot = path.resolve('D:/projects/interactive-git-learning');
  const desktopShellRoot = path.join(workspaceRoot, 'apps', 'desktop-shell');
  const app = await electron.launch({
    executablePath: electronBinary,
    args: [path.join(desktopShellRoot, 'dist-electron', 'main.js')],
    cwd: desktopShellRoot,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'ELECTRON_RUN_AS_NODE'))
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Create Practice Repo' }).click();
    await page.screenshot({ path: path.join(workspaceRoot, 'tmp-layout-check.png'), fullPage: true });
  } finally {
    await app.close();
  }
})();
