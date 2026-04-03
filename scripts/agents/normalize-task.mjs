import path from "node:path";
import {
  ensureDir,
  normalizeAgentTaskSpec,
  normalizeGitHubTaskSpec,
  readJson,
  slugify,
  writeJson
} from "./lib/contracts.mjs";

function getFlag(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const inputPath = getFlag("--input");
const source = getFlag("--source", "local");
const outputDir = getFlag("--output-dir", path.resolve("tasks/ready"));

if (!inputPath) {
  throw new Error("Usage: node scripts/agents/normalize-task.mjs --input <path> [--source local|github-event] [--output-dir <dir>]");
}

const payload = await readJson(path.resolve(inputPath));
const task = source === "github-event" ? normalizeGitHubTaskSpec(payload) : normalizeAgentTaskSpec(payload);

await ensureDir(outputDir);
const outputPath = path.join(outputDir, `${slugify(task.id)}.json`);
await writeJson(outputPath, task);

console.log(outputPath);
