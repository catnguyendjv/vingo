import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:55321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

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

// Term đã enroll trong test — dọn ở afterEach để idempotent (review_logs cascade theo card).
let enrolledTerm: string | null = null;

test.afterEach(async () => {
  if (!enrolledTerm) return;
  await admin.from("review_cards").delete().eq("user_id", await devUserId()).eq("term", enrolledTerm);
  enrolledTerm = null;
});

test("SRS: enroll từ flashcard → badge header → /review chấm Được → Undo (desktop)", async ({ page }) => {
  await login(page);

  // Vào bài có từ vựng, tab "Tất cả"
  await page.locator("a[href^='/lessons/']").first().click();
  await expect(page.locator("video")).toBeVisible();
  await page.getByRole("tab", { name: /Tất cả/ }).click();

  // Chọn flashcard chưa thuộc và chưa trong ôn tập (mặt sau còn nút Ôn tập). Lấy thẻ CUỐI để không đụng
  // smoke.spec (chạy song song, toggle known trên thẻ ĐẦU — enroll sẽ gỡ known_words của từ đó).
  // Locator của Playwright là lazy: sau khi enroll, thẻ mất nút Ôn tập nên phải ghim theo aria-label (term).
  const candidate = page
    .locator('[data-testid="flashcard"][data-known="false"]:visible')
    .filter({ has: page.getByTestId("flashcard-enroll") })
    .last();
  await expect(candidate).toBeVisible();
  enrolledTerm = ((await candidate.getAttribute("aria-label")) ?? "").trim();
  expect(enrolledTerm.length).toBeGreaterThan(0);
  const card = page.locator(`[data-testid="flashcard"][aria-label="${enrolledTerm}"]:visible`).first();
  await card.hover();                                     // desktop: hover lật mặt sau
  await card.getByTestId("flashcard-enroll").click();
  await expect(page.getByTestId("study-toast")).toContainText("vào ôn tập");
  await expect(card.getByText("Đang ôn")).toBeVisible();

  // Header có badge, /review có thẻ vừa enroll
  await page.goto("/review");
  await expect(page.getByTestId("review-badge")).toBeVisible();
  const review = page.getByTestId("review-card");
  await expect(review).toHaveAttribute("data-revealed", "false");
  await expect(review).toContainText(enrolledTerm);
  await review.click();
  await expect(review).toHaveAttribute("data-revealed", "true");
  await expect(page.getByRole("link", { name: /Mở trong bài/ })).toHaveAttribute("href", /#cueid=/);

  // Chấm Được → 1 đã chấm; Undo → 0 đã chấm, thẻ về mặt trước
  await page.getByTestId("review-rating-3").click();
  await expect(page.getByTestId("review-progress")).toContainText("1 đã chấm");
  await expect(page.getByTestId("review-undo")).toBeEnabled();
  await page.getByTestId("review-undo").click();
  await expect(page.getByTestId("review-progress")).toContainText("0 đã chấm");
  await expect(review).toHaveAttribute("data-revealed", "false");

  // Từ điển hiện chip Đang ôn cho từ đó
  await page.goto("/dictionary");
  const row = page.getByTestId("dict-table").locator(`tr[data-term="${enrolledTerm}"]`);
  await expect(row).toContainText("Đang ôn");
});
