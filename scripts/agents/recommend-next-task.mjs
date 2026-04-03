import path from "node:path";
import { promises as fs } from "node:fs";
import { buildRecommendationReport, ensureDir, readJson, writeJson } from "./lib/contracts.mjs";

function getFlag(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const readyDir = getFlag("--ready-dir", path.resolve("tasks/ready"));
const inboxDir = getFlag("--inbox-dir", path.resolve("tasks/inbox"));
const outputPath = getFlag("--output", path.resolve("tasks/recommendations/next-best-task.json"));

async function readTaskBucket(bucket, dirPath) {
  try {
    const entries = await fs.readdir(dirPath);
    const items = [];
    for (const file of entries.filter((entry) => entry.endsWith(".json")).sort()) {
      const task = await readJson(path.join(dirPath, file));
      items.push({ bucket, ...task });
    }
    return items;
  } catch {
    return [];
  }
}

const tasks = [
  ...(await readTaskBucket("ready", path.resolve(readyDir))),
  ...(await readTaskBucket("inbox", path.resolve(inboxDir)))
];

const report = buildRecommendationReport(tasks);
await ensureDir(path.dirname(outputPath));
await writeJson(path.resolve(outputPath), report);

console.log(path.resolve(outputPath));
