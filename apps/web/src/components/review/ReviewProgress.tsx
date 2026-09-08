"use client";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";

/** `done` = số lượt đã chấm trong phiên; `remaining` = số thẻ còn trong hàng đợi (thẻ requeue tính lại). */
export function ReviewProgress({ done, remaining, dueLeft, newLeft, canUndo, pending, onUndo }: {
  done: number; remaining: number; dueLeft: number; newLeft: number;
  canUndo: boolean; pending: boolean; onUndo: () => void;
}) {
  const total = done + remaining;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div data-testid="review-progress" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h1 className="flex items-baseline gap-2">
          <span lang="ja" className="font-jp text-base font-medium text-muted">復習</span>
          <span className="text-[22px] font-bold tracking-[-0.02em]">Ôn tập</span>
        </h1>
        <span className="ml-auto text-sm tabular-nums"><b className="font-semibold">{done}</b> đã chấm · <b className="font-semibold">{remaining}</b> còn lại</span>
        <IconButton label="Hoàn tác lần chấm cuối (Z)" data-testid="review-undo" disabled={!canUndo || pending} onClick={onUndo} className="disabled:opacity-40">
          <Icon name="flip" className="size-[18px]" />
        </IconButton>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="flex gap-3 text-xs text-muted">
        <span>Còn <span className="font-semibold tabular-nums text-ink">{dueLeft}</span> đến hạn</span>
        <span>· <span className="font-semibold tabular-nums text-ink">{newLeft}</span> thẻ mới</span>
      </p>
    </div>
  );
}
