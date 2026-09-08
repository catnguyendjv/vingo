import { expect, test, type Locator, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="email"]', "cat@vingo.local");
  await page.fill('input[name="password"]', "devpass123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("tab", { name: "Của tôi" })).toBeVisible();
}

// Bấm Chia sẻ (đang private) → dialog → tick checkbox nếu có (bài zoom) → xác nhận.
async function shareViaDialog(page: Page, btn: Locator) {
  await btn.click();
  // StudyView là một cây DOM: ShareButton render 2 lần (hàng tiêu đề mobile + StudyControls desktop) → 2 <dialog>; lấy cái đang mở.
  const dlg = page.locator('[data-testid="share-dialog"][open]');
  await expect(dlg).toBeVisible();
  const cb = dlg.getByRole("checkbox");
  if (await cb.count()) await cb.click();
  await dlg.getByRole("button", { name: /Chia sẻ lên cộng đồng/ }).click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
}

test("share → tab Cộng đồng thấy bài → ngừng share (idempotent)", async ({ page }) => {
  await login(page);
  await page.locator("a[href^='/lessons/']").first().click();
  await expect(page.locator("video")).toBeVisible();
  const url = page.url();
  // Desktop: nút Chia sẻ nằm trong StudyControls (hàng tiêu đề mobile bị ẩn) → lấy nút đang hiển thị.
  const btn = page.locator('[data-testid="share-button"]:visible');
  await expect(btn).toBeVisible();
  const wasShared = (await btn.getAttribute("aria-pressed")) === "true";
  if (wasShared) { await btn.click(); await expect(btn).toHaveAttribute("aria-pressed", "false"); }

  await shareViaDialog(page, btn);
  await expect(page.getByTestId("study-toast")).toHaveText("Đã chia sẻ lên cộng đồng");

  // Tab Cộng đồng có bài + badge "Của bạn"
  await page.goto("/?tab=community");
  const card = page.locator(`a[href='${new URL(url).pathname}']`);
  await expect(card).toBeVisible();
  await expect(card.getByText("Của bạn")).toBeVisible();

  // Tab Của tôi có badge "Cộng đồng"
  await page.goto("/?tab=mine");
  await expect(page.locator(`a[href='${new URL(url).pathname}']`).getByText("Cộng đồng")).toBeVisible();

  // Ngừng chia sẻ (không dialog)
  await page.goto(url);
  const again = page.locator('[data-testid="share-button"]:visible');
  await expect(again).toHaveAttribute("aria-pressed", "true");
  await again.click();
  await expect(again).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("study-toast")).toHaveText("Đã ngừng chia sẻ");

  // Trả lại trạng thái ban đầu nếu bài vốn đang chia sẻ
  if (wasShared) await shareViaDialog(page, again);
});
