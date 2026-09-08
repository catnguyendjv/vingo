"use client";
import Link from "next/link";
import type { QueueRow, StateName } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { BadgeKind } from "@/lib/lesson-status";

const STATE_LABEL: Record<StateName, { label: string; kind: BadgeKind }> = {
  New: { label: "Mới", kind: "draft" },
  Learning: { label: "Đang học", kind: "learning" },
  Relearning: { label: "Học lại", kind: "learning" },
  Review: { label: "Ôn", kind: "done" },
};

export function ReviewCard({ row, revealed, onToggle }: { row: QueueRow; revealed: boolean; onToggle: () => void }) {
  const st = STATE_LABEL[row.state];
  const face = "col-start-1 row-start-1 flex min-h-[280px] flex-col rounded-lg border p-5 text-left lg:min-h-[320px]";
  const hasContext = !!row.cue_text_source;
  const hasLink = !!row.source_lesson_id && !!row.source_cue_id;
  return (
    <div
      data-testid="review-card" data-revealed={revealed ? "true" : "false"}
      role="button" tabIndex={0} aria-label={revealed ? `${row.term}: đáp án` : `${row.term}: chạm để hiện đáp án`}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onToggle(); } }}
      className={cn("rc relative grid w-full cursor-pointer select-none", revealed && "rc-flipped")}
    >
      {/* Mặt trước */}
      <div className={cn(face, "rc-front items-center justify-center gap-4 border-line bg-surface")} aria-hidden={revealed}>
        <Badge kind={st.kind}>{st.label}</Badge>
        <span lang="ja" className="font-jp text-[40px] font-semibold leading-tight tracking-tight lg:text-5xl">{row.term}</span>
        <span className="text-xs text-muted">Chạm để hiện đáp án</span>
      </div>

      {/* Mặt sau */}
      <div className={cn(face, "rc-back gap-3 border-line bg-surface-2")} aria-hidden={!revealed}>
        <div className="flex flex-col gap-1">
          <span lang="ja" className="font-jp text-2xl font-semibold leading-tight">{row.term}</span>
          {row.reading && <span lang="ja" className="font-jp text-sm text-muted">{row.reading}</span>}
        </div>
        <p className="text-lg leading-snug">{row.meaning ?? "—"}</p>
        {hasContext && (
          <div className="mt-auto flex flex-col gap-1.5 rounded-md border border-line bg-surface p-3">
            <p lang="ja" className="font-jp text-[15px] leading-relaxed">{row.cue_text_source}</p>
            {row.cue_text_target && <p className="text-sm text-muted">{row.cue_text_target}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {row.lesson_title && <span lang="ja" className="font-jp truncate">{row.lesson_title}{row.cue_idx != null && ` · #${row.cue_idx}`}</span>}
              {hasLink && (
                <Link
                  href={`/lessons/${row.source_lesson_id}#cueid=${row.source_cue_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                >
                  Mở trong bài<Icon name="arrow-up-right" className="size-3.5" />
                </Link>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
