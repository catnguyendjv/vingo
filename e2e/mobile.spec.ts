// Polish mobile (spec P2 §6): video compact khi cuộn, nút ‹ ›, layout landscape. Emulate iPhone 13 trên Chromium.
import { devices, expect, test, type Page } from "@playwright/test";

const { defaultBrowserType: _browser, ...iphone13 } = devices["iPhone 13"];
test.use(iphone13);

async function login(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="email"]', "cat@vingo.local");
  await page.fill('input[name="password"]', "devpass123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("tab", { name: "Của tôi" })).toBeVisible();
}

test("portrait: cuộn → video compact; ‹ › đổi câu", async ({ page }) => {
  await login(page);
  await page.locator("a[href^='/lessons/']").first().click();
  const frame = page.getByTestId("video-frame");
  await expect(frame).toHaveAttribute("data-mode", "full");
  await expect(page.getByTestId("mobile-dock")).toBeVisible();

  await page.mouse.wheel(0, 600);
  await expect(frame).toHaveAttribute("data-mode", "compact");
  // Video compact nằm trong hàng tiêu đề, không che hàng tab (nút › vẫn bấm được).
  const next = page.getByTestId("next-cue");
  await expect(next).toBeVisible();
  await next.click();
  await expect(page.locator("[data-testid=cue-item][data-active=true]")).toHaveCount(1);

  // Chạm video compact → về đầu trang → full. Dừng phát trước: cue đổi sẽ scrollIntoView câu đang phát và
  // đè lên cuộn về đầu (auto-follow có từ trước).
  await page.locator("video").evaluate((v: HTMLVideoElement) => v.pause());
  await page.waitForTimeout(500);
  await frame.click({ position: { x: 5, y: 5 } });
  await expect(frame).toHaveAttribute("data-mode", "full");
});

test("landscape: header/dock ẩn, 2 cột, cue list thấy được", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("app-header")).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  // Trang thư viện vẫn giữ header khi xoay ngang (chỉ trang học ẩn).
  await expect(page.getByTestId("app-header")).toBeVisible();

  await page.locator("a[href^='/lessons/']").first().click();
  await expect(page.getByTestId("app-header")).toBeHidden();
  await expect(page.getByTestId("mobile-dock")).toBeHidden();
  await expect(page.getByTestId("cue-list")).toBeVisible();
  await expect(page.getByTestId("video-frame")).toHaveAttribute("data-mode", "full");
  // Video không tràn khỏi cột trái / màn hình.
  const box = await page.getByTestId("video-frame").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(390);
  expect(box!.x + box!.width).toBeLessThanOrEqual(844 * 0.6);
});
