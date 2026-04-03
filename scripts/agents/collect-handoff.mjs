import path from "node:path";
import { promises as fs } from "node:fs";
import { ensureDir, readJson, renderHandoffMarkdown } from "./lib/contracts.mjs";

function getFlag(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const handoffDir = getFlag("--handoff-dir");
const outputPath = getFlag("--output", path.resolve("tasks/done/agent-handoff-summary.md"));

if (!handoffDir) {
  throw new Error("Usage: node scripts/agents/collect-handoff.mjs --handoff-dir <dir> [--output <file>]");
}

const entries = await fs.readdir(path.resolve(handoffDir));
const summaries = [];

for (const entry of entries.filter((file) => file.endsWith(".json")).sort()) {
  const handoff = await readJson(path.join(path.resolve(handoffDir), entry));
  summaries.push(renderHandoffMarkdown(handoff));
}

await ensureDir(path.dirname(outputPath));
await fs.writeFile(path.resolve(outputPath), `${summaries.join("\n---\n\n")}\n`, "utf8");

console.log(path.resolve(outputPath));
