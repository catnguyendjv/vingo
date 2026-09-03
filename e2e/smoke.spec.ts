import { expect, test } from "@playwright/test";

test("login → thư viện → trang học → từ điển", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="email"]', "cat@vingo.local");
  await page.fill('input[name="password"]', "devpass123");
  await page.click("button:has-text('Đăng nhập')");
  await expect(page.locator("text=Của tôi")).toBeVisible();

  await page.locator("a[href^='/lessons/']").first().click();
  await expect(page.locator("video")).toBeVisible();
  await page.locator("ol li").nth(2).click();          // click câu → seek
  const t = await page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime);
  expect(t).toBeGreaterThan(0);

  await page.goto("/dictionary");
  await expect(page.locator("table tbody tr").first()).toBeVisible();
});
