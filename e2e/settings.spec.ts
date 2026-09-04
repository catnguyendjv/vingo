import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:55321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const SEED_LABEL = "E2E Seed Device";

async function login(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="email"]', "cat@vingo.local");
  await page.fill('input[name="password"]', "devpass123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("tab", { name: "Của tôi" })).toBeVisible();
}

async function devUserId(): Promise<string> {
  const { data } = await admin.auth.admin.listUsers();
  const u = data.users.find((x) => x.email === "cat@vingo.local");
  if (!u) throw new Error("dev user cat@vingo.local chưa tồn tại — chạy scripts/create-dev-user.mjs");
  return u.id;
}

test.afterEach(async () => {
  // Dọn grant seed để idempotent.
  await admin.from("mcp_grants").delete().eq("device_label", SEED_LABEL);
});

test("/settings sinh mã ghép nối hiển thị + lệnh kết nối", async ({ page }) => {
  await login(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Cài đặt" })).toBeVisible();

  await page.getByTestId("generate-code").click();
  const code = page.getByTestId("pairing-code");
  await expect(code).toBeVisible();
  expect(((await code.textContent()) ?? "").trim()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);

  // 2 lệnh kết nối hiển thị.
  await expect(page.getByText("claude mcp add --transport http study-kit", { exact: false })).toBeVisible();
  await expect(page.getByText("claude mcp login study-kit", { exact: false })).toBeVisible();
});

test("/settings liệt kê thiết bị đã kết nối và thu hồi được", async ({ page }) => {
  const uid = await devUserId();
  await admin.from("mcp_grants").delete().eq("device_label", SEED_LABEL); // sạch trước
  await admin.from("mcp_grants").insert({
    user_id: uid,
    client_id: "e2e-client",
    device_label: SEED_LABEL,
    access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  });

  await login(page);
  await page.goto("/settings");

  const row = page.getByTestId("device-row").filter({ hasText: SEED_LABEL });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Thu hồi" }).click();
  await expect(row).toHaveCount(0);

  // Đã revoke trong DB.
  const { data } = await admin
    .from("mcp_grants")
    .select("revoked_at")
    .eq("device_label", SEED_LABEL)
    .single();
  expect(data?.revoked_at).not.toBeNull();
});
