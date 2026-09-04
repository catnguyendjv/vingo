import { defineConfig } from "vitest/config";

// Integration test (pipeline ffmpeg, oauth flow) chạy tuần tự với Supabase local → nới timeout.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    // BASE_URL/PORT cố định để oauth.test dựng issuer khớp server nghe.
    env: { BASE_URL: "http://127.0.0.1:8799", PORT: "8799" },
  },
});
