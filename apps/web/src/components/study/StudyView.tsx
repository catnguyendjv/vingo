"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CueRow, LessonRow, VocabRow } from "@/lib/types";
import { Html5PlayerAdapter, type PlayerAdapter } from "@/lib/player";
import { findActiveCueIndex, nextUndoneIndex } from "@/lib/cues";
import { createClient } from "@/lib/supabase/client";
import { CueList } from "./CueList";
import { VocabPanel } from "./VocabPanel";

export type StudyViewProps = {
  lesson: LessonRow; cues: CueRow[]; vocab: VocabRow[]; videoUrl: string | null;
  initialDoneCueIds: string[]; initialKnownTerms: string[]; canEdit: boolean; userId: string;
};

export default function StudyView({ lesson, cues, vocab, videoUrl, initialDoneCueIds, initialKnownTerms, canEdit, userId }: StudyViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<PlayerAdapter | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [showTarget, setShowTarget] = useState(true);
  const [rate, setRate] = useState(1);
  const [abRange, setAbRange] = useState<{ start: number; end: number } | null>(null);
  const abRef = useRef(abRange);
  abRef.current = abRange;
  const hashSeekDone = useRef(false);

  const supabase = useMemo(() => createClient(), []);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(initialDoneCueIds));
  const [knownTerms, setKnownTerms] = useState<Set<string>>(new Set(initialKnownTerms));
  const [editMode, setEditMode] = useState(false);
  const [localCues, setLocalCues] = useState(cues);
  const [localVocab, setLocalVocab] = useState(vocab);

  const saveCueText = async (cueId: string, patch: { text_source?: string; text_target?: string }) => {
    setLocalCues((cs) => cs.map((c) => (c.id === cueId ? { ...c, ...patch } : c)));
    await supabase.from("cues").update(patch).eq("id", cueId);
  };
  const addVocab = async (cueId: string, term: string, reading: string, meaning: string) => {
    const row = { id: crypto.randomUUID(), lesson_id: lesson.id, cue_id: cueId, term, reading: reading || null, meaning, sort: null };
    setLocalVocab((v) => [...v, row]);
    await supabase.from("vocab_items").insert(row);
  };
  const removeVocab = async (id: string) => {
    setLocalVocab((v) => v.filter((x) => x.id !== id));
    await supabase.from("vocab_items").delete().eq("id", id);
  };

  useEffect(() => {
    if (!videoRef.current) return;
    const player = new Html5PlayerAdapter(videoRef.current);
    playerRef.current = player;
    const off = player.onTime((ms) => {
      setActiveIdx(findActiveCueIndex(localCues, ms));
      const ab = abRef.current;
      if (ab && ms >= ab.end) player.seekTo(ab.start);
    });
    if (!hashSeekDone.current) {
      hashSeekDone.current = true;
      const mIdx = location.hash.match(/^#cue=(\d+)$/);
      const mId = location.hash.match(/^#cueid=([0-9a-f-]{36})$/);
      const cue = mIdx ? localCues.find((c) => c.idx === Number(mIdx[1]))
               : mId ? localCues.find((c) => c.id === mId[1]) : undefined;
      if (cue) player.seekTo(cue.start_ms);
    }
    return () => { off(); player.destroy(); };
  }, [localCues]);

  const seekToCue = (i: number) => { playerRef.current?.seekTo(localCues[i].start_ms); playerRef.current?.play(); };
  const toggleAb = () => {
    if (abRange) return setAbRange(null);
    if (activeIdx >= 0) setAbRange({ start: localCues[activeIdx].start_ms, end: localCues[activeIdx].end_ms });
  };
  const changeRate = (r: number) => { setRate(r); playerRef.current?.setRate(r); };
  const vocabByCue = useMemo(() => {
    const m = new Map<string, VocabRow[]>();
    for (const v of localVocab) { const arr = m.get(v.cue_id) ?? []; arr.push(v); m.set(v.cue_id, arr); }
    return m;
  }, [localVocab]);

  const toggleDone = async (cue: CueRow) => {
    const next = new Set(doneIds);
    if (next.has(cue.id)) {
      next.delete(cue.id); setDoneIds(next);
      await supabase.from("cue_progress").delete().eq("cue_id", cue.id);
    } else {
      next.add(cue.id); setDoneIds(next);
      await supabase.from("cue_progress").upsert({ cue_id: cue.id, lesson_id: lesson.id, user_id: userId });
    }
  };
  const markUpToActive = async () => {
    if (activeIdx < 0) return;
    const rows = localCues.slice(0, activeIdx + 1).map((c) => ({ cue_id: c.id, lesson_id: lesson.id, user_id: userId }));
    setDoneIds(new Set([...doneIds, ...rows.map((r) => r.cue_id)]));
    await supabase.from("cue_progress").upsert(rows);
  };
  const continueStudy = () => {
    const i = nextUndoneIndex(localCues, doneIds);
    if (i >= 0) seekToCue(i);
  };
  const toggleKnown = async (term: string, reading: string | null, meaning: string | null) => {
    const next = new Set(knownTerms);
    if (next.has(term)) {
      next.delete(term); setKnownTerms(next);
      await supabase.from("known_words").delete().match({ lang: lesson.source_lang, term });
    } else {
      next.add(term); setKnownTerms(next);
      await supabase.from("known_words").upsert({
        user_id: userId, lang: lesson.source_lang, term, reading, meaning, first_lesson_id: lesson.id,
      });
    }
  };

  return (
    <main className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div>
        <h1 className="mb-2 text-lg font-bold">{lesson.title}</h1>
        {videoUrl
          ? <video ref={videoRef} src={videoUrl} controls playsInline className="w-full rounded bg-black" />
          : <div className="flex aspect-video items-center justify-center rounded bg-gray-100 text-sm text-gray-500">Video chưa sẵn sàng ({lesson.status})</div>}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <button onClick={toggleAb} className={`rounded border px-2 py-1 ${abRange ? "bg-black text-white" : ""}`}>🔁 Lặp câu</button>
          <label>Tốc độ
            <select value={rate} onChange={(e) => changeRate(Number(e.target.value))} className="ml-1 rounded border p-1">
              {[0.5, 0.75, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{r}x</option>)}
            </select>
          </label>
          <button onClick={() => setShowTarget((s) => !s)} className="rounded border px-2 py-1">
            {showTarget ? "Ẩn" : "Hiện"} bản dịch
          </button>
          <button onClick={markUpToActive} className="rounded border px-2 py-1">✓ Đã học tới câu đang phát</button>
          <button onClick={continueStudy} className="rounded border px-2 py-1">▶ Tiếp tục</button>
          <span className="text-xs text-gray-500">{doneIds.size}/{localCues.length} câu</span>
          {canEdit && <button onClick={() => setEditMode((e) => !e)} className={`rounded border px-2 py-1 ${editMode ? "bg-black text-white" : ""}`}>✎ Sửa</button>}
        </div>
      </div>
      <div>
        <CueList cues={localCues} activeIdx={activeIdx} showTarget={showTarget} onSeek={seekToCue} vocabByCue={vocabByCue} doneIds={doneIds} onToggleDone={toggleDone} editMode={editMode} onSaveCue={saveCueText} />
        <VocabPanel vocab={localVocab} knownTerms={knownTerms} onToggleKnown={toggleKnown} activeCueId={activeIdx >= 0 ? localCues[activeIdx].id : null} editMode={editMode} onAdd={(term, reading, meaning) => activeIdx >= 0 && addVocab(localCues[activeIdx].id, term, reading, meaning)} onRemove={removeVocab} />
      </div>
    </main>
  );
}
