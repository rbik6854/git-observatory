import { execFileSync } from "node:child_process";
import path from "node:path";

function getFlag(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const worktreePath = getFlag("--worktree");

if (!worktreePath) {
  throw new Error("Usage: node scripts/agents/cleanup-worktree.mjs --worktree <path>");
}

execFileSync("git", ["worktree", "remove", "--force", path.resolve(worktreePath)], {
  stdio: "inherit"
});
execFileSync("git", ["worktree", "prune"], { stdio: "inherit" });
