import { defineConfig } from "@playwright/test";
export default defineConfig({
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  testDir: ".",
  // Dev server (turbopack) không chịu được nhiều worker cùng mở trang học 1000 câu (test chạm mốc 30s, video không kịp
  // hiện, thao tác lệch nhịp) → local chạy tuần tự 1 worker (~2 phút).
  workers: process.env.CI ? undefined : 1,
});
