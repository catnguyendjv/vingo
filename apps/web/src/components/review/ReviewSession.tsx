"use client";
import { useEffect, useMemo, useState } from "react";
import type { QueueRow, ReviewStats } from "@/lib/types";
import { applyPatch, buildQueue, patchOf, scheduleOptions, shouldRequeue, type ScheduleOption } from "@/lib/srs";
import { createReviewApi, type ReviewApi } from "@/lib/review-api";
import { createClient } from "@/lib/supabase/client";
import { ReviewCard } from "./ReviewCard";
import { ReviewActions } from "./ReviewActions";
import { ReviewProgress } from "./ReviewProgress";
import { ReviewEmpty } from "./ReviewEmpty";

export type ReviewSessionProps = {
  initialQueue: QueueRow[]; stats: ReviewStats; hasAnyCard: boolean;
  /** Inject khi test; mặc định tạo từ Supabase browser client. */
  api?: ReviewApi;
  now?: () => Date;
};

/** Giữ toàn bộ state phiên ôn (theo pattern StudyView); các con chỉ nhận props. */
export function ReviewSession({ initialQueue, stats, hasAnyCard, api: apiProp, now = () => new Date() }: ReviewSessionProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const api = useMemo(() => apiProp ?? createReviewApi(createClient()), []);
  const [queue, setQueue] = useState<QueueRow[]>(() => buildQueue(initialQueue));
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [undo, setUndo] = useState<{ prev: QueueRow } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = queue[0] ?? null;
  // Tính lúc lật để `now` sát thời điểm chấm.
  const options = useMemo(
    () => (current && revealed ? scheduleOptions(current, now()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, revealed],
  );

  const rate = async (o: ScheduleOption) => {
    const cur = queue[0];
    if (!cur || pending) return;
    const rest = queue.slice(1);
    const updated = applyPatch(cur, o.patch);
    setUndo({ prev: cur });
    setRevealed(false);
    setPending(true);
    setError(null);
    setQueue(shouldRequeue(o.patch, now()) ? [...rest, updated] : rest);
    setReviewed((n) => n + 1);
    try {
      await api.review(cur.id, o.rating, o.patch, o.log);
    } catch (e) {
      setError((e as Error).message);
      setQueue((q) => [cur, ...q.filter((r) => r.id !== cur.id)]);
      setReviewed((n) => Math.max(0, n - 1));
      setUndo(null);
    } finally {
      setPending(false);
    }
  };

  const undoLast = async () => {
    if (!undo || pending) return;
    const { prev } = undo;
    setPending(true);
    setError(null);
    try {
      await api.undo(prev.id, patchOf(prev));
      setQueue((q) => [prev, ...q.filter((r) => r.id !== prev.id)]);
      setReviewed((n) => Math.max(0, n - 1));
      setRevealed(false);
      setUndo(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === " ") { e.preventDefault(); if (current) setRevealed((r) => !r); return; }
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); void undoLast(); return; }
      if (revealed && options && /^[1-4]$/.test(e.key)) {
        const o = options.find((x) => x.key === e.key);
        if (o) { e.preventDefault(); void rate(o); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, revealed, options, pending, undo, queue]);

  const dueLeft = queue.filter((r) => r.state !== "New").length;
  const newLeft = queue.length - dueLeft;

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-4 pb-[120px] lg:pb-0">
      <ReviewProgress done={reviewed} remaining={queue.length} dueLeft={dueLeft} newLeft={newLeft} canUndo={!!undo} pending={pending} onUndo={undoLast} />
      {error && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
          Không lưu được: {error}
        </p>
      )}
      {current ? (
        <>
          <ReviewCard row={current} revealed={revealed} onToggle={() => setRevealed((r) => !r)} />
          <ReviewActions revealed={revealed} options={options} pending={pending} onReveal={() => setRevealed(true)} onRate={rate} />
        </>
      ) : (
        <ReviewEmpty kind={hasAnyCard || reviewed > 0 ? "done" : "none"} reviewed={reviewed} nextDueAt={stats.next_due_at} now={now()} />
      )}
    </main>
  );
}
