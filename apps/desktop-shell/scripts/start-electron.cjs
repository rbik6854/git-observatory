const { spawn } = require("node:child_process");
const path = require("node:path");

const electronBinary = require("electron");
const cwd = path.resolve(__dirname, "..");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ["."], {
  cwd,
  stdio: "inherit",
  env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
