"use client";
import type { Ref } from "react";
import type { CueRow, VocabRow } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";

export function CueItem({
  ref, cue, index, active, done, showTarget, vocab, editMode, onSeek, onToggleDone, onSaveCue,
}: {
  ref?: Ref<HTMLLIElement>; cue: CueRow; index: number; active: boolean; done: boolean; showTarget: boolean;
  vocab: VocabRow[]; editMode: boolean; onSeek: () => void; onToggleDone: () => void;
  onSaveCue: (patch: { text_source?: string; text_target?: string }) => void;
}) {
  return (
    <li
      ref={ref} data-testid="cue-item" data-active={active ? "true" : "false"}
      tabIndex={0}
      onClick={onSeek}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSeek(); }
      }}
      className={cn(
        "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-md border-l-[3px] px-3 py-2.5 transition-colors scroll-mt-[330px] lg:scroll-mt-2 land:scroll-mt-2",
        active ? "border-accent bg-active-cue" : "border-transparent hover:bg-surface-2",
      )}
    >
      <Checkbox checked={done} onChange={onToggleDone} label={`Đã học câu ${index + 1}`} size="lg" className="mt-0.5 lg:size-[26px]" />
      {editMode ? (
        <div onClick={(e) => e.stopPropagation()} className="col-span-2 flex flex-col gap-1.5">
          <input
            lang="ja" defaultValue={cue.text_source}
            className="h-9 w-full rounded-sm border border-line bg-surface px-2.5 font-jp text-sm outline-none focus:border-accent"
            onBlur={(e) => e.target.value !== cue.text_source && onSaveCue({ text_source: e.target.value })}
          />
          <input
            defaultValue={cue.text_target ?? ""}
            className="h-8 w-full rounded-sm border border-line bg-surface px-2.5 text-xs outline-none focus:border-accent"
            onBlur={(e) => e.target.value !== (cue.text_target ?? "") && onSaveCue({ text_target: e.target.value })}
          />
        </div>
      ) : (
        <>
          <div className="min-w-0">
            <p lang="ja" className={cn("font-jp text-[17px] leading-[1.55] lg:text-[15.5px]", active && "font-medium")}>
              {cue.uncertain && (
                <span title={cue.note ?? "Câu chưa chắc chắn"} className="mr-1 inline-flex -translate-y-px align-middle text-warning">
                  <Icon name="alert-triangle" className="size-4" />
                </span>
              )}
              {cue.text_source}
            </p>
            {showTarget && cue.text_target && (
              <p className="mt-0.5 text-[13.5px] leading-snug text-muted lg:text-[13px]">{cue.text_target}</p>
            )}
            {vocab.length > 0 && (
              <p lang="ja" className="mt-1 font-jp text-[12.5px] leading-snug text-accent">
                {vocab.map((v) => `${v.term}${v.reading ? `（${v.reading}）` : ""} ${v.meaning ?? ""}`).join(" · ")}
              </p>
            )}
          </div>
          <span className="text-[11px] tabular-nums text-muted">{formatTimestamp(cue.start_ms)}</span>
        </>
      )}
    </li>
  );
}
