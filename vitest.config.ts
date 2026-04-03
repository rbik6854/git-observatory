import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@git-observatory/core-domain": path.resolve(__dirname, "packages/core-domain/src"),
      "@git-observatory/core-analysis": path.resolve(__dirname, "packages/core-analysis/src"),
      "@git-observatory/core-lessons": path.resolve(__dirname, "packages/core-lessons/src"),
      "@git-observatory/ui-shared": path.resolve(__dirname, "packages/ui-shared/src"),
      "@git-observatory/desktop-git-adapter": path.resolve(__dirname, "packages/desktop-git-adapter/src")
    }
  }
});
