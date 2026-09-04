import type { LessonRow } from "./types";
import { percent } from "./format";

export type BadgeKind = "learning" | "done" | "draft" | "processing" | "error";
export type Progress = { done: number; total: number };

export function badgeFor(status: LessonRow["status"], p: Progress): { kind: BadgeKind; label: string } | null {
  if (status === "draft") return { kind: "draft", label: "nháp — chưa có video" };
  if (status === "processing") return { kind: "processing", label: "đang xử lý video…" };
  if (status === "error") return { kind: "error", label: "lỗi xử lý video" };
  if (p.total > 0 && p.done >= p.total) return { kind: "done", label: "Xong" };
  if (p.done > 0) return { kind: "learning", label: "Tiếp tục" };
  return null;
}

export function progressLabel(status: LessonRow["status"], p: Progress): string {
  if (status !== "ready") return "chưa sẵn sàng";
  if (p.total === 0) return "chưa có câu";
  if (p.done === 0) return "chưa bắt đầu";
  if (p.done >= p.total) return "hoàn thành";
  return `đang học · ${percent(p.done, p.total)}%`;
}
