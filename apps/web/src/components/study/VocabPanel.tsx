"use client";
import { useState } from "react";
import type { VocabRow } from "@/lib/types";

export function VocabPanel({ vocab, knownTerms, onToggleKnown, activeCueId }: {
  vocab: VocabRow[]; knownTerms: Set<string>;
  onToggleKnown: (term: string, reading: string | null, meaning: string | null) => void;
  activeCueId: string | null;
}) {
  const [hideKnown, setHideKnown] = useState(false);
  const shown = vocab.filter((v) => !hideKnown || !knownTerms.has(v.term));
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Từ vựng ({shown.length})</h2>
        <button onClick={() => setHideKnown((h) => !h)} className="text-xs text-gray-500">
          {hideKnown ? "Hiện" : "Ẩn"} từ thuộc
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {shown.map((v) => {
          const known = knownTerms.has(v.term);
          return (
            <button key={v.id} onClick={() => onToggleKnown(v.term, v.reading, v.meaning)}
              title={`${v.reading ?? ""} — ${v.meaning ?? ""}`}
              className={`rounded border px-2 py-1 text-sm ${known ? "text-gray-400 line-through" : ""} ${v.cue_id === activeCueId ? "border-black" : ""}`}>
              {v.term}{known ? " ✓" : ""}
            </button>
          );
        })}
      </div>
    </section>
  );
}
