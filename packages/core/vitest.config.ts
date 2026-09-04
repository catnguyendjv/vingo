import { defineConfig } from "vitest/config";

// Integration test chạy với Supabase local → nới timeout.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], testTimeout: 30000, hookTimeout: 30000 },
});
