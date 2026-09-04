"use client";
import { useEffect, useRef } from "react";
import type { CueRow, VocabRow } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { CueItem } from "./CueItem";

export function CueList({ cues, activeIdx, showTarget, onSeek, vocabByCue, doneIds, onToggleDone, editMode, onSaveCue }: {
  cues: CueRow[]; activeIdx: number; showTarget: boolean;
  onSeek: (i: number) => void; vocabByCue: Map<string, VocabRow[]>;
  doneIds: Set<string>; onToggleDone: (cue: CueRow) => void;
  editMode: boolean; onSaveCue: (cueId: string, patch: { text_source?: string; text_target?: string }) => void;
}) {
  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [activeIdx]);
  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">
          Câu <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-muted">{cues.length}</span>
        </h2>
        <span className="hidden items-center gap-1 text-[11px] text-muted lg:inline-flex">
          <Icon name="repeat" className="size-3" />tự cuộn theo câu đang phát
        </span>
      </header>
      <ol data-testid="cue-list" className="flex flex-col p-2 lg:max-h-[560px] lg:overflow-y-auto">
        {cues.map((c, i) => (
          <CueItem
            key={c.id} ref={i === activeIdx ? activeRef : undefined}
            cue={c} index={i} active={i === activeIdx} done={doneIds.has(c.id)} showTarget={showTarget}
            vocab={vocabByCue.get(c.id) ?? []} editMode={editMode}
            onSeek={() => onSeek(i)} onToggleDone={() => onToggleDone(c)} onSaveCue={(patch) => onSaveCue(c.id, patch)}
          />
        ))}
      </ol>
    </section>
  );
}
