import { execFileSync } from "node:child_process";
import path from "node:path";
import { ensureDir, readJson, slugify } from "./lib/contracts.mjs";

function getFlag(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const taskPath = getFlag("--task");
const subtaskId = getFlag("--subtask");
const rootDir = getFlag("--root", path.resolve(".agent-worktrees"));
const branchPrefix = getFlag("--branch-prefix", "agent");
const baseRef = getFlag("--base", "HEAD");

if (!taskPath || !subtaskId) {
  throw new Error("Usage: node scripts/agents/allocate-worktree.mjs --task <task.json> --subtask <subtask-id> [--root <dir>] [--branch-prefix <prefix>] [--base <ref>]");
}

const task = await readJson(path.resolve(taskPath));
const worktreeDir = path.join(rootDir, `${slugify(task.id)}-${slugify(subtaskId)}`);
const branchName = `${branchPrefix}/${slugify(task.id)}/${slugify(subtaskId)}`;

await ensureDir(rootDir);
execFileSync("git", ["worktree", "add", "-b", branchName, worktreeDir, baseRef], {
  stdio: "inherit"
});

console.log(JSON.stringify({ branchName, worktreeDir }, null, 2));
