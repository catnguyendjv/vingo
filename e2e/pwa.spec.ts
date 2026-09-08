// PWA / service worker (spec P2 §5). SW chỉ đăng ký ở production nên file này cần build + start riêng,
// KHÔNG chạy trên dev server :3000:
//   NEXT_DIST_DIR=.next-e2e pnpm --filter web build
//   NEXT_DIST_DIR=.next-e2e pnpm --filter web exec next start -p 3200
//   E2E_PWA=1 E2E_BASE_URL=http://localhost:3200 pnpm e2e -- pwa.spec.ts
import { expect, test, type Page } from "@playwright/test";

test.skip(!process.env.E2E_PWA, "cần production build + next start riêng (E2E_PWA=1, E2E_BASE_URL)");

async function login(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="email"]', "cat@vingo.local");
  await page.fill('input[name="password"]', "devpass123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("tab", { name: "Của tôi" })).toBeVisible();
}

test("đăng ký SW, phục vụ /offline khi mất mạng, đăng nhập vẫn hoạt động", async ({ page, context }) => {
  await page.goto("/login");
  // install → skipWaiting → activate → clients.claim(): trang hiện tại có controller mà không cần reload.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 });
  const cacheKeys: string[] = await page.evaluate(() => caches.keys());
  expect(cacheKeys).toContain("vingo-v1");
  const hasOffline = await page.evaluate(async () => (await caches.match("/offline")) != null);
  expect(hasOffline).toBe(true);

  await context.setOffline(true);
  await page.goto("/dictionary").catch(() => {});
  await expect(page.getByRole("heading", { name: "Không có kết nối" })).toBeVisible();
  await context.setOffline(false);

  // Cache-first cho static, network-first cho navigate không được phá auth: đăng nhập qua server action
  // (POST, SW bỏ qua) rồi redirect vào thư viện.
  await login(page);
  await page.goto("/dictionary");
  await expect(page).toHaveURL(/\/dictionary/);
  await expect(page.getByRole("heading", { name: "Không có kết nối" })).toHaveCount(0);
  // Không cần dọn: mỗi test có browser context riêng, session/SW không rò sang test khác.
});
