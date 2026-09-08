// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReviewSession } from "./ReviewSession";
import type { QueueRow, ReviewStats } from "@/lib/types";

const row = (id: string, term: string, extra: Partial<QueueRow> = {}): QueueRow => ({
  id, lang: "ja", term, reading: "よみ", meaning: `nghĩa ${term}`,
  due_at: "2026-09-08T08:00:00Z", stability: null, difficulty: null, scheduled_days: null, learning_steps: null,
  reps: 0, lapses: 0, state: "New", last_review_at: null, created_at: "2026-09-01T00:00:00Z",
  source_lesson_id: "L1", lesson_title: "Bài 1", source_cue_id: "C1", cue_idx: 3,
  cue_text_source: `${term}を確認します`, cue_text_target: "xác nhận", ...extra,
});
const stats: ReviewStats = { due: 0, new_available: 2, new_last_24h: 0, next_due_at: null };
const mockApi = () => ({
  review: vi.fn().mockResolvedValue(undefined),
  undo: vi.fn().mockResolvedValue(undefined),
  enroll: vi.fn().mockResolvedValue({ created: 0, reactivated: 0 }),
});
const now = () => new Date("2026-09-08T09:00:00Z");

afterEach(cleanup);

describe("ReviewSession", () => {
  it("rỗng: chưa có card nào → hướng dẫn enroll", () => {
    render(<ReviewSession initialQueue={[]} stats={{ ...stats, new_available: 0 }} hasAnyCard={false} api={mockApi()} now={now} />);
    expect(screen.getByTestId("review-empty").getAttribute("data-kind")).toBe("none");
  });

  it("có card nhưng hết hàng đợi → màn Xong", () => {
    render(<ReviewSession initialQueue={[]} stats={{ ...stats, new_available: 0, next_due_at: "2026-09-09T09:00:00Z" }} hasAnyCard api={mockApi()} now={now} />);
    expect(screen.getByTestId("review-empty").getAttribute("data-kind")).toBe("done");
    expect(screen.getByTestId("review-empty").textContent).toContain("1 ngày");
  });

  it("lật bằng click, 4 nút chỉ hiện sau khi lật, mặt sau có câu ví dụ + link", () => {
    render(<ReviewSession initialQueue={[row("a", "決済")]} stats={stats} hasAnyCard api={mockApi()} now={now} />);
    expect(screen.queryByTestId("review-rating-3")).toBeNull();
    expect(screen.getByTestId("review-card").getAttribute("data-revealed")).toBe("false");
    fireEvent.click(screen.getByTestId("review-card"));
    expect(screen.getByTestId("review-card").getAttribute("data-revealed")).toBe("true");
    expect(screen.getByText("決済を確認します")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Mở trong bài/ }).getAttribute("href")).toBe("/lessons/L1#cueid=C1");
    expect(screen.getByTestId("review-rating-3")).toBeTruthy();
  });

  it("chấm Good → api.review với reps=1, sang thẻ sau; Undo trả thẻ về đầu", async () => {
    const api = mockApi();
    render(<ReviewSession initialQueue={[row("a", "決済"), row("b", "確認")]} stats={stats} hasAnyCard api={api} now={now} />);
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByTestId("review-card").getAttribute("data-revealed")).toBe("true");
    fireEvent.click(screen.getByTestId("review-rating-3"));
    await waitFor(() => expect(api.review).toHaveBeenCalledTimes(1));
    const [cardId, rating, patch] = api.review.mock.calls[0];
    expect(cardId).toBe("a");
    expect(rating).toBe(3);
    expect(patch.reps).toBe(1);
    expect(screen.getByTestId("review-card").textContent).toContain("確認");
    // Good trên thẻ New → learning step 10 phút → thẻ quay lại cuối hàng đợi: 1 đã chấm, 2 còn lại
    expect(screen.getByTestId("review-progress").textContent).toContain("1 đã chấm · 2 còn lại");

    fireEvent.click(screen.getByTestId("review-undo"));
    await waitFor(() => expect(api.undo).toHaveBeenCalledWith("a", expect.objectContaining({ state: "New", reps: 0 })));
    expect(screen.getByTestId("review-card").textContent).toContain("決済");
    expect(screen.getByTestId("review-card").getAttribute("data-revealed")).toBe("false");
    expect(screen.getByTestId("review-progress").textContent).toContain("0 đã chấm · 2 còn lại");
  });

  it("phím 1–4 chấm khi đã lật, Z hoàn tác", async () => {
    const api = mockApi();
    render(<ReviewSession initialQueue={[row("a", "決済"), row("b", "確認")]} stats={stats} hasAnyCard api={api} now={now} />);
    fireEvent.keyDown(window, { key: "3" });                 // chưa lật → bỏ qua
    expect(api.review).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "4" });
    await waitFor(() => expect(api.review).toHaveBeenCalledWith("a", 4, expect.anything(), expect.anything()));
    await waitFor(() => expect((screen.getByTestId("review-undo") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.keyDown(window, { key: "z" });
    await waitFor(() => expect(api.undo).toHaveBeenCalledTimes(1));
  });

  it("Again trên thẻ New → requeue về cuối; Easy → rời phiên → màn Xong", async () => {
    const api = mockApi();
    render(<ReviewSession initialQueue={[row("a", "決済")]} stats={stats} hasAnyCard api={api} now={now} />);
    fireEvent.click(screen.getByTestId("review-card"));
    fireEvent.click(screen.getByTestId("review-rating-1"));
    await waitFor(() => expect(api.review).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("review-card").textContent).toContain("決済");
    fireEvent.click(screen.getByTestId("review-card"));
    fireEvent.click(screen.getByTestId("review-rating-4"));
    await waitFor(() => expect(screen.getByTestId("review-empty").getAttribute("data-kind")).toBe("done"));
    expect(screen.getByTestId("review-empty").textContent).toContain("2");
  });

  it("RPC lỗi → thẻ về đầu hàng đợi, có alert, không còn Undo", async () => {
    const api = mockApi();
    api.review.mockRejectedValue(new Error("boom"));
    render(<ReviewSession initialQueue={[row("a", "決済"), row("b", "確認")]} stats={stats} hasAnyCard api={api} now={now} />);
    fireEvent.click(screen.getByTestId("review-card"));
    fireEvent.click(screen.getByTestId("review-rating-3"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("boom"));
    expect(screen.getByTestId("review-card").textContent).toContain("決済");
    expect((screen.getByTestId("review-undo") as HTMLButtonElement).disabled).toBe(true);
  });

  it("thẻ mất ngữ cảnh (bài đã xoá) vẫn ôn được, không có link", () => {
    render(<ReviewSession initialQueue={[row("a", "決済", { source_lesson_id: null, lesson_title: null, source_cue_id: null, cue_text_source: null, cue_text_target: null })]} stats={stats} hasAnyCard api={mockApi()} now={now} />);
    fireEvent.click(screen.getByTestId("review-card"));
    expect(screen.queryByRole("link", { name: /Mở trong bài/ })).toBeNull();
    expect(screen.getByText("nghĩa 決済")).toBeTruthy();
  });
});
