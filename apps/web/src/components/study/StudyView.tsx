"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CueRow, LessonRow, VocabRow } from "@/lib/types";
import { Html5PlayerAdapter, type PlayerAdapter } from "@/lib/player";
import { findActiveCueIndex } from "@/lib/cues";
import { CueList } from "./CueList";

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

  useEffect(() => {
    if (!videoRef.current) return;
    const player = new Html5PlayerAdapter(videoRef.current);
    playerRef.current = player;
    const off = player.onTime((ms) => {
      setActiveIdx(findActiveCueIndex(cues, ms));
      const ab = abRef.current;
      if (ab && ms >= ab.end) player.seekTo(ab.start);
    });
    const m = location.hash.match(/^#cue=(\d+)$/);
    if (m) {
      const cue = cues.find((c) => c.idx === Number(m[1]));
      if (cue) player.seekTo(cue.start_ms);
    }
    return () => { off(); player.destroy(); };
  }, [cues]);

  const seekToCue = (i: number) => { playerRef.current?.seekTo(cues[i].start_ms); playerRef.current?.play(); };
  const toggleAb = () => {
    if (abRange) return setAbRange(null);
    if (activeIdx >= 0) setAbRange({ start: cues[activeIdx].start_ms, end: cues[activeIdx].end_ms });
  };
  const changeRate = (r: number) => { setRate(r); playerRef.current?.setRate(r); };
  const vocabByCue = useMemo(() => {
    const m = new Map<string, VocabRow[]>();
    for (const v of vocab) { const arr = m.get(v.cue_id) ?? []; arr.push(v); m.set(v.cue_id, arr); }
    return m;
  }, [vocab]);

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
        </div>
      </div>
      <CueList cues={cues} activeIdx={activeIdx} showTarget={showTarget} onSeek={seekToCue} vocabByCue={vocabByCue} />
    </main>
  );
}
