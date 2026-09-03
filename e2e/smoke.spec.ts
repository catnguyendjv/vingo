import { expect, test } from "@playwright/test";

test("login → thư viện → trang học → từ điển → đánh dấu từ", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="email"]', "cat@vingo.local");
  await page.fill('input[name="password"]', "devpass123");
  await page.click("button:has-text('Đăng nhập')");
  await expect(page.locator("text=Của tôi")).toBeVisible();

  await page.locator("a[href^='/lessons/']").first().click();
  await expect(page.locator("video")).toBeVisible();
  const lessonUrl = page.url();
  await page.locator("ol li").nth(2).click();          // click câu → seek
  const t = await page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime);
  expect(t).toBeGreaterThan(0);

  // spec §9: đánh dấu 1 từ vựng "đã thuộc" trong panel Từ vựng, kiểm tra phản ánh đúng ở /dictionary.
  const vocabSection = page.locator("section").filter({ hasText: "Từ vựng" });
  const firstChip = vocabSection.locator("button").nth(1); // nth(0) là nút toggle "Ẩn/Hiện từ thuộc"
  const term = ((await firstChip.textContent()) ?? "").trim();
  expect(term.length).toBeGreaterThan(0);
  await firstChip.click();
  await expect(firstChip).toContainText("✓");

  await page.goto("/dictionary");
  const row = page.locator("table tbody tr").filter({ hasText: term });
  await expect(row.first()).toBeVisible();
  await expect(row.first().locator('input[type="checkbox"]')).toBeChecked();

  // Reload trang học (điều hướng thẳng, không dùng bfcache) để xác nhận trạng thái đã persist,
  // rồi bỏ đánh dấu lại — giữ test idempotent để chạy lại nhiều lần.
  await page.goto(lessonUrl);
  await expect(page.locator("video")).toBeVisible();
  const chipAgain = page.locator("section").filter({ hasText: "Từ vựng" }).locator("button").nth(1);
  await expect(chipAgain).toContainText("✓");
  await chipAgain.click();
  await expect(chipAgain).not.toContainText("✓");
});
