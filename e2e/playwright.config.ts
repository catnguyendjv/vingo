import { defineConfig } from "@playwright/test";
export default defineConfig({
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  testDir: ".",
});
