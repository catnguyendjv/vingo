import { describe, expect, it } from "vitest";
import { badgeFor, progressLabel } from "./lesson-status";

describe("badgeFor", () => {
  it("draft/processing/error ưu tiên hơn tiến độ", () => {
    expect(badgeFor("draft", { done: 5, total: 10 })).toEqual({ kind: "draft", label: "nháp — chưa có video" });
    expect(badgeFor("processing", { done: 0, total: 0 })).toEqual({ kind: "processing", label: "đang xử lý video…" });
    expect(badgeFor("error", { done: 10, total: 10 })).toEqual({ kind: "error", label: "lỗi xử lý video" });
  });
  it("ready + học hết → Xong", () => expect(badgeFor("ready", { done: 140, total: 140 })).toEqual({ kind: "done", label: "Xong" }));
  it("ready + đang học → Tiếp tục", () => expect(badgeFor("ready", { done: 37, total: 576 })).toEqual({ kind: "learning", label: "Tiếp tục" }));
  it("ready + chưa học → không badge", () => expect(badgeFor("ready", { done: 0, total: 140 })).toBeNull());
  it("ready + không có câu → không badge", () => expect(badgeFor("ready", { done: 0, total: 0 })).toBeNull());
});

describe("progressLabel", () => {
  it("chưa sẵn sàng", () => expect(progressLabel("draft", { done: 0, total: 140 })).toBe("chưa sẵn sàng"));
  it("chưa bắt đầu", () => expect(progressLabel("ready", { done: 0, total: 140 })).toBe("chưa bắt đầu"));
  it("đang học kèm %", () => expect(progressLabel("ready", { done: 37, total: 576 })).toBe("đang học · 6%"));
  it("hoàn thành", () => expect(progressLabel("ready", { done: 140, total: 140 })).toBe("hoàn thành"));
  it("không có câu", () => expect(progressLabel("ready", { done: 0, total: 0 })).toBe("chưa có câu"));
});
