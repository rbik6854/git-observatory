import { promises as fs } from "node:fs";
import { validatePullRequestBody } from "./lib/contracts.mjs";

const inputFile = process.argv.includes("--input") ? process.argv[process.argv.indexOf("--input") + 1] : "";
const body = inputFile ? await fs.readFile(inputFile, "utf8") : process.env.PR_BODY ?? "";

const missing = validatePullRequestBody(body);

if (missing.length > 0) {
  console.error(`PR body is missing required sections: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("PR body includes all required agent handoff sections.");
