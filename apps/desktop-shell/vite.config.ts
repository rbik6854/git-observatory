import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@git-observatory/core-domain": path.resolve(__dirname, "../../packages/core-domain/src"),
      "@git-observatory/core-analysis": path.resolve(__dirname, "../../packages/core-analysis/src"),
      "@git-observatory/ui-shared": path.resolve(__dirname, "../../packages/ui-shared/src")
    }
  },
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true
  }
});
