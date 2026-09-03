"use client";
import { useEffect, useRef } from "react";
import type { CueRow, VocabRow } from "@/lib/types";

export function CueList({ cues, activeIdx, showTarget, onSeek, vocabByCue, doneIds, onToggleDone, editMode, onSaveCue }: {
  cues: CueRow[]; activeIdx: number; showTarget: boolean;
  onSeek: (i: number) => void; vocabByCue: Map<string, VocabRow[]>;
  doneIds: Set<string>; onToggleDone: (cue: CueRow) => void;
  editMode: boolean; onSaveCue: (cueId: string, patch: { text_source?: string; text_target?: string }) => void;
}) {
  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [activeIdx]);
  return (
    <ol className="max-h-[75vh] space-y-1 overflow-y-auto pr-1">
      {cues.map((c, i) => (
        <li key={c.id} ref={i === activeIdx ? activeRef : undefined}
            className={`cursor-pointer rounded border p-2 ${i === activeIdx ? "border-black bg-yellow-50" : "border-transparent hover:bg-gray-50"}`}
            onClick={() => onSeek(i)}>
          {editMode ? (
            <div onClick={(e) => e.stopPropagation()} className="space-y-1">
              <input defaultValue={c.text_source} className="w-full rounded border p-1 text-sm"
                onBlur={(e) => e.target.value !== c.text_source && onSaveCue(c.id, { text_source: e.target.value })} />
              <input defaultValue={c.text_target ?? ""} className="w-full rounded border p-1 text-xs"
                onBlur={(e) => e.target.value !== (c.text_target ?? "") && onSaveCue(c.id, { text_target: e.target.value })} />
            </div>
          ) : (
            <>
              <p className="text-sm">
                <input type="checkbox" checked={doneIds.has(c.id)}
                  onClick={(e) => e.stopPropagation()} onChange={() => onToggleDone(c)} />
                {" "}{c.uncertain && <span title={c.note ?? ""}>⚠ </span>}{c.text_source}
              </p>
              {showTarget && c.text_target && <p className="text-xs text-gray-500">{c.text_target}</p>}
            </>
          )}
          {(vocabByCue.get(c.id) ?? []).length > 0 && (
            <p className="mt-1 text-xs text-blue-700">
              {(vocabByCue.get(c.id) ?? []).map((v) => `${v.term}${v.reading ? `（${v.reading}）` : ""} ${v.meaning ?? ""}`).join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
