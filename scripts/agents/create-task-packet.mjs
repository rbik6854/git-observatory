import path from "node:path";
import { createExecutionManifest, ensureDir, readJson, slugify, writeJson } from "./lib/contracts.mjs";

function getFlag(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const taskPath = getFlag("--task");
const outputRoot = getFlag("--output-dir", path.resolve(".agents/runs"));

if (!taskPath) {
  throw new Error("Usage: node scripts/agents/create-task-packet.mjs --task <task.json> [--output-dir <dir>]");
}

const task = await readJson(path.resolve(taskPath));
const manifest = createExecutionManifest(task);
const runDir = path.join(outputRoot, slugify(task.id));
await ensureDir(runDir);
await writeJson(path.join(runDir, "execution-manifest.json"), manifest);

for (const subtask of manifest.subtasks) {
  await writeJson(path.join(runDir, `${slugify(subtask.id)}.json`), {
    taskId: manifest.taskId,
    ...subtask
  });
}

console.log(runDir);
