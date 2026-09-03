import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], passWithNoTests: true },
  css: { postcss: { plugins: [] } },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
