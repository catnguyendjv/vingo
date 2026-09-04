import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="email"]', "cat@vingo.local");
  await page.fill('input[name="password"]', "devpass123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("tab", { name: "Của tôi" })).toBeVisible();
}

test("login → thư viện → trang học → từ điển → đánh dấu từ (desktop)", async ({ page }) => {
  await login(page);

  await page.locator("a[href^='/lessons/']").first().click();
  await expect(page.locator("video")).toBeVisible();
  const lessonUrl = page.url();
  await page.getByTestId("cue-item").nth(2).click();          // click câu → seek
  const t = await page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime);
  expect(t).toBeGreaterThan(0);

  // Flashcard hiển thị (desktop): click thẻ = đánh dấu đã thuộc
  // Tab mặc định "Câu này" có thể rỗng nếu câu đang phát không có vocab → chuyển sang "Tất cả".
  await page.getByRole("tab", { name: /Tất cả/ }).click();
  const card = page.locator('[data-testid="flashcard"]:visible').first();
  const term = ((await card.locator(".fc-front span[lang='ja']").first().textContent()) ?? "").trim();
  expect(term.length).toBeGreaterThan(0);
  const wasKnown = (await card.getAttribute("data-known")) === "true";
  await card.click();
  await expect(card).toHaveAttribute("data-known", String(!wasKnown));

  // Phản ánh ở /dictionary (bảng desktop)
  await page.goto("/dictionary");
  const row = page.getByTestId("dict-table").locator(`tr[data-term="${term}"]`);
  await expect(row).toBeVisible();
  await expect(row.getByRole("checkbox")).toHaveAttribute("aria-checked", String(!wasKnown));

  // Reload trang học → persist; bấm lại để trả về trạng thái cũ (idempotent)
  await page.goto(lessonUrl);
  await expect(page.locator("video")).toBeVisible();
  await page.getByRole("tab", { name: /Tất cả/ }).click();
  const again = page.locator('[data-testid="flashcard"]:visible').first();
  await expect(again).toHaveAttribute("data-known", String(!wasKnown));
  await again.click();
  await expect(again).toHaveAttribute("data-known", String(wasKnown));
});

test("đổi theme sáng/tối lưu cookie và giữ sau reload", async ({ page, context }) => {
  await login(page);
  const html = page.locator("html");
  await page.getByTestId("theme-toggle").click();
  const theme = await html.getAttribute("data-theme");
  expect(["light", "dark"]).toContain(theme);
  const cookie = (await context.cookies()).find((c) => c.name === "vingo-theme");
  expect(cookie?.value).toBe(theme);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", theme!);
  // đảo lại để không ảnh hưởng lần chạy sau
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", theme === "dark" ? "light" : "dark");
});

test.describe("mobile 390", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("dock đáy, tab Từ vựng, flashcard chạm lật rồi đánh dấu qua nút mặt sau", async ({ page }) => {
    await login(page);
    await page.locator("a[href^='/lessons/']").first().click();
    await expect(page.locator("video")).toBeVisible();
    await expect(page.getByTestId("mobile-dock")).toBeVisible();

    await page.getByRole("tab", { name: /Từ vựng/ }).click();
    const card = page.locator('[data-testid="flashcard"]:visible').first();
    const wasKnown = (await card.getAttribute("data-known")) === "true";
    await card.locator(".fc-front").tap();
    await expect(card).toHaveClass(/fc-flipped/);
    await expect(card).toHaveAttribute("data-known", String(wasKnown)); // chạm không đánh dấu
    await card.getByRole("button", { name: wasKnown ? "Bỏ đã thuộc" : "✓ Đã thuộc" }).tap();
    await expect(card).toHaveAttribute("data-known", String(!wasKnown));
    await expect(card).not.toHaveClass(/fc-flipped/);

    // trả lại trạng thái cũ
    await card.locator(".fc-front").tap();
    await card.getByRole("button", { name: !wasKnown ? "Bỏ đã thuộc" : "✓ Đã thuộc" }).tap();
    await expect(card).toHaveAttribute("data-known", String(wasKnown));

    // từ điển dạng thẻ
    await page.goto("/dictionary");
    await expect(page.getByTestId("dict-list")).toBeVisible();
    await expect(page.getByTestId("dict-table")).toBeHidden();
  });
});
