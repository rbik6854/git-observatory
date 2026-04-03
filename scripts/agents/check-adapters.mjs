import { loadSkillsRegistry, validateRegistryFiles } from "./lib/contracts.mjs";

const registry = await loadSkillsRegistry();
const problems = await validateRegistryFiles(registry);

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}

console.log(`Validated ${registry.skills.length} canonical skills and adapter pointers.`);
