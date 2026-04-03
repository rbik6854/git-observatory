import path from "node:path";
import { promises as fs } from "node:fs";
import { normalizeAgentTaskSpec, readJson, validatePullRequestBody } from "./lib/contracts.mjs";

async function validateTaskDirectory(dirPath) {
  try {
    const entries = await fs.readdir(dirPath);
    for (const entry of entries.filter((file) => file.endsWith(".json")).sort()) {
      normalizeAgentTaskSpec(await readJson(path.join(dirPath, entry)));
    }
  } catch (error) {
    if ((error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      return;
    }
    throw error;
  }
}

await validateTaskDirectory(path.resolve("tasks/inbox"));
await validateTaskDirectory(path.resolve("tasks/ready"));

const prTemplatePath = path.resolve(".github/PULL_REQUEST_TEMPLATE.md");
try {
  const prTemplate = await fs.readFile(prTemplatePath, "utf8");
  const missingHeadings = validatePullRequestBody(prTemplate);
  if (missingHeadings.length > 0) {
    throw new Error(`PR template is missing required headings: ${missingHeadings.join(", ")}`);
  }
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    throw new Error("Missing .github/PULL_REQUEST_TEMPLATE.md");
  }
  throw error;
}

console.log("Validated local task artifacts and PR template headings.");
