"use client";
import { useState } from "react";
import type { VocabRow } from "@/lib/types";

export function VocabPanel({ vocab, knownTerms, onToggleKnown, activeCueId, editMode, onAdd, onRemove }: {
  vocab: VocabRow[]; knownTerms: Set<string>;
  onToggleKnown: (term: string, reading: string | null, meaning: string | null) => void;
  activeCueId: string | null;
  editMode: boolean;
  onAdd: (term: string, reading: string, meaning: string) => void;
  onRemove: (id: string) => void;
}) {
  const [hideKnown, setHideKnown] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newReading, setNewReading] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
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
              {editMode && (
                <span onClick={(e) => { e.stopPropagation(); onRemove(v.id); }} className="ml-1 text-red-500">✕</span>
              )}
            </button>
          );
        })}
      </div>
      {editMode && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="term"
            className="w-20 rounded border p-1 text-sm" />
          <input value={newReading} onChange={(e) => setNewReading(e.target.value)} placeholder="reading"
            className="w-20 rounded border p-1 text-sm" />
          <input value={newMeaning} onChange={(e) => setNewMeaning(e.target.value)} placeholder="meaning"
            className="w-24 rounded border p-1 text-sm" />
          <button
            disabled={activeCueId == null || !newTerm || !newMeaning}
            onClick={() => { onAdd(newTerm, newReading, newMeaning); setNewTerm(""); setNewReading(""); setNewMeaning(""); }}
            className="rounded border px-2 py-1 text-sm disabled:opacity-50">
            ＋ Thêm từ vào câu đang phát
          </button>
        </div>
      )}
    </section>
  );
}
