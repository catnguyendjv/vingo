"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CueRow, EnrollItem, LessonRow, VocabRow } from "@/lib/types";
import { createReviewApi } from "@/lib/review-api";
import type { PlayerAdapter, PlayerState } from "@/lib/player";
import { checkMatch } from "@/lib/local-video";
import { findActiveCueIndex, nextUndoneIndex, stepIndex } from "@/lib/cues";
import { useWakeLock } from "@/lib/use-wake-lock";
import { percent } from "@/lib/format";
import { badgeFor } from "@/lib/lesson-status";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { CueList } from "./CueList";
import { VocabPanel } from "./VocabPanel";
import { StudyControls } from "./StudyControls";
import { MobileDock } from "./MobileDock";
import { VideoFrame } from "./VideoFrame";
import { ShareButton } from "./ShareButton";

export type StudyViewProps = {
  lesson: LessonRow; cues: CueRow[]; vocab: VocabRow[]; videoUrl: string | null;
  initialDoneCueIds: string[]; initialKnownTerms: string[]; initialReviewTerms: string[]; canEdit: boolean; userId: string;
};

export default function StudyView({ lesson, cues, vocab, videoUrl, initialDoneCueIds, initialKnownTerms, initialReviewTerms, canEdit, userId }: StudyViewProps) {
  const playerRef = useRef<PlayerAdapter | null>(null);
  // YouTube không cho seek trước cử chỉ đầu (spec P2 §3.2): giữ seek ban đầu, áp khi state PLAYING lần đầu.
  const pendingSeekRef = useRef<number | null>(null);
  // Trạng thái phát: lộ ra data-player-state trên <main>; Wake Lock giữ màn hình sáng khi đang phát (spec P2 §6 M5).
  const [playerState, setPlayerState] = useState<PlayerState>("paused");
  useWakeLock(playerState === "playing");
  // Video local (spec P2 §2.6): object URL của file người học chọn; revoke khi đổi file/unmount (effect bên dưới).
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [localWarn, setLocalWarn] = useState<string[]>([]);
  const localFileRef = useRef<File | null>(null);
  const pickLocal = (file: File) => {
    localFileRef.current = file;
    setLocalWarn([]);
    setLocalUrl(URL.createObjectURL(file));
  };
  const clearLocal = () => { localFileRef.current = null; setLocalWarn([]); setLocalUrl(null); };
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
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
  const [reviewTerms, setReviewTerms] = useState<Set<string>>(new Set(initialReviewTerms));
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const notify = (m: string) => {
    setToast(m);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  };
  const [editMode, setEditMode] = useState(false);
  const [localCues, setLocalCues] = useState(cues);
  // Ref cho onTime của player: sửa câu (edit mode) không phải tạo lại adapter.
  const localCuesRef = useRef(localCues);
  localCuesRef.current = localCues;
  const [localVocab, setLocalVocab] = useState(vocab);

  // Share community (spec P2 §4.2): optimistic + rollback + toast; RLS chỉ cho owner UPDATE.
  const [visibility, setVisibility] = useState(lesson.visibility);
  const changeVisibility = async (v: LessonRow["visibility"]) => {
    const prev = visibility; setVisibility(v);
    const { error } = await supabase.from("lessons").update({ visibility: v }).eq("id", lesson.id);
    if (error) { setVisibility(prev); notify(`Lỗi: ${error.message}`); }
    else notify(v === "community" ? "Đã chia sẻ lên cộng đồng" : "Đã ngừng chia sẻ");
  };
  const shareButton = canEdit && <ShareButton lesson={lesson} visibility={visibility} onChange={changeVisibility} />;

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

  // Seek ban đầu: hash `#cue=<idx>` / `#cueid=<uuid>`; không có hash → câu chưa học đầu (spec P2 §6 M6).
  // Chỉ tính một lần cho cả phiên. i = 0 hoặc -1 (chưa học gì / học hết) → không seek.
  const initialSeekMs = (): number | null => {
    if (hashSeekDone.current) return null;
    hashSeekDone.current = true;
    const cs = localCuesRef.current;
    const mIdx = location.hash.match(/^#cue=(\d+)$/);
    const mId = location.hash.match(/^#cueid=([0-9a-f-]{36})$/);
    if (mIdx || mId) {
      const cue = mIdx ? cs.find((c) => c.idx === Number(mIdx[1])) : cs.find((c) => c.id === mId![1]);
      return cue ? cue.start_ms : null;
    }
    const i = nextUndoneIndex(cs, doneIds);
    return i > 0 ? cs[i].start_ms : null;
  };
  // VideoFrame gọi mỗi khi tạo adapter mới (đổi nguồn: bài local chọn file); adapter cũ đã destroy → listener tự gỡ.
  const onPlayerReady = (player: PlayerAdapter) => {
    playerRef.current = player;
    player.onTime((ms) => {
      setActiveIdx(findActiveCueIndex(localCuesRef.current, ms));
      const ab = abRef.current;
      if (ab && ms >= ab.end) player.seekTo(ab.start);
    });
    player.onStateChange((s) => {
      setPlayerState(s);
      if (s === "playing" && pendingSeekRef.current != null) {
        player.seekTo(pendingSeekRef.current);
        pendingSeekRef.current = null;
      }
    });
    const initial = initialSeekMs();
    if (initial != null) {
      if (lesson.video_provider === "youtube") pendingSeekRef.current = initial;
      else player.seekTo(initial);
    }
  };

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
      // Trigger DB sẽ suspend card SRS; bỏ chip "Đang ôn" ngay cho khớp.
      setReviewTerms((s) => { const n = new Set(s); n.delete(term); return n; });
      await supabase.from("known_words").upsert({
        user_id: userId, lang: lesson.source_lang, term, reading, meaning, first_lesson_id: lesson.id,
      });
    }
  };

  // ---- SRS enroll (spec P1.5 §4.3) ----
  const reviewApi = useMemo(() => createReviewApi(supabase), [supabase]);
  const itemOf = (v: VocabRow): EnrollItem => ({
    lang: lesson.source_lang, term: v.term, reading: v.reading, meaning: v.meaning, lesson_id: lesson.id, cue_id: v.cue_id,
  });
  const enrollTerm = async (v: VocabRow) => {
    setReviewTerms((s) => new Set(s).add(v.term));
    setKnownTerms((s) => { const n = new Set(s); n.delete(v.term); return n; });   // RPC gỡ known_words
    try {
      await reviewApi.enroll([itemOf(v)]);
      notify(`Đã đưa ${v.term} vào ôn tập`);
    } catch (e) {
      setReviewTerms((s) => { const n = new Set(s); n.delete(v.term); return n; });
      notify(`Lỗi: ${(e as Error).message}`);
    }
  };
  const enrollable = useMemo(() => {
    const seen = new Set<string>();
    return localVocab.filter((v) => !knownTerms.has(v.term) && !reviewTerms.has(v.term) && !seen.has(v.term) && !!seen.add(v.term));
  }, [localVocab, knownTerms, reviewTerms]);
  const enrollLesson = async () => {
    if (!enrollable.length) return notify("Không còn từ nào để thêm");
    const terms = enrollable.map((v) => v.term);
    setReviewTerms((s) => new Set([...s, ...terms]));
    try {
      const r = await reviewApi.enroll(enrollable.map(itemOf));
      notify(`Đã thêm ${r.created} từ vào ôn tập${r.reactivated ? `, ${r.reactivated} từ đã có` : ""}`);
    } catch (e) {
      setReviewTerms((s) => { const n = new Set(s); terms.forEach((t) => n.delete(t)); return n; });
      notify(`Lỗi: ${(e as Error).message}`);
    }
  };

  const [mobileTab, setMobileTab] = useState<"cues" | "vocab">("cues");
  const nextIdx = nextUndoneIndex(localCues, doneIds);
  const badge = badgeFor(lesson.status, { done: doneIds.size, total: localCues.length });

  const controls = {
    abActive: !!abRange, onToggleAb: toggleAb,
    rate, onChangeRate: changeRate,
    showTarget, onToggleTarget: () => setShowTarget((s) => !s),
    onMarkUpToActive: markUpToActive, onContinue: continueStudy,
    done: doneIds.size, total: localCues.length,
    canEdit, editMode, onToggleEdit: () => setEditMode((e) => !e),
    activeIdx, nextIdx,
  };

  return (
    <main data-player-state={playerState} className="pb-[84px] lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6 lg:pb-0">
      {/* Khối trái: sticky trên mobile, tĩnh trên desktop */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-page px-4 pb-2 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:gap-3 lg:px-0 lg:pb-0">
        <div className="flex h-[52px] items-center gap-1 lg:hidden">
          <Link href="/" aria-label="Về thư viện" className="grid size-[38px] shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
            <Icon name="chevron-left" className="size-5" />
          </Link>
          <h1 lang="ja" className="min-w-0 flex-1 truncate font-jp text-sm font-semibold">{lesson.title}</h1>
          {shareButton}
          {canEdit && (
            <IconButton label="Sửa bài" pressed={editMode} onClick={() => setEditMode((e) => !e)}>
              <Icon name="pencil" className="size-[18px]" />
            </IconButton>
          )}
        </div>
        <h1 lang="ja" className="hidden font-jp text-xl font-semibold leading-snug lg:block">{lesson.title}</h1>

        <VideoFrame
          lesson={lesson} videoUrl={videoUrl} localUrl={localUrl} mode="full" badge={badge}
          onReady={onPlayerReady} onLocalFile={pickLocal}
          onLoadedMetadata={(durationSec) => {
            if (!localFileRef.current) return;
            setLocalWarn(checkMatch(localFileRef.current, durationSec, lesson).reasons);
          }}
        />
        {localWarn.length > 0 && (
          <div role="status" className="flex items-center justify-between gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
            <span>File có thể không đúng ({localWarn.join(", ")}).</span>
            <button type="button" className="font-semibold underline" onClick={clearLocal}>Chọn file khác</button>
          </div>
        )}

        <StudyControls className="hidden lg:flex" extra={shareButton} {...controls} />

        <div className="flex items-center justify-between gap-2 lg:hidden">
          <SegmentedControl
            ariaLabel="Nội dung" tight value={mobileTab} onChange={setMobileTab}
            items={[
              { value: "cues", label: <>Câu · <span className="tabular-nums">{doneIds.size}/{localCues.length}</span></> },
              { value: "vocab", label: <>Từ vựng · <span className="tabular-nums">{localVocab.length}</span></> },
            ]}
          />
          {/* ‹ › nhảy câu: chưa có câu đang phát → câu chưa học đầu (spec P2 §6 M6) */}
          <div className="flex items-center gap-1">
            <IconButton
              label="Câu trước" data-testid="prev-cue" disabled={!localCues.length}
              onClick={() => seekToCue(stepIndex(activeIdx, -1, localCues.length, nextIdx))}
            >
              <Icon name="chevron-left" className="size-5" />
            </IconButton>
            <IconButton
              label="Câu sau" data-testid="next-cue" disabled={!localCues.length}
              onClick={() => seekToCue(stepIndex(activeIdx, 1, localCues.length, nextIdx))}
            >
              <Icon name="chevron-right" className="size-5" />
            </IconButton>
            <ProgressRing value={percent(doneIds.size, localCues.length)} size={32} label />
          </div>
        </div>
      </div>

      {/* Khối phải */}
      <div className="flex flex-col gap-4 pt-2 lg:pt-0">
        <div className={cn(mobileTab !== "cues" && "hidden lg:block")}>
          <CueList
            cues={localCues} activeIdx={activeIdx} showTarget={showTarget} onSeek={seekToCue}
            vocabByCue={vocabByCue} doneIds={doneIds} onToggleDone={toggleDone}
            editMode={editMode} onSaveCue={saveCueText}
          />
        </div>
        <div className={cn(mobileTab !== "vocab" && "hidden lg:block")}>
          <VocabPanel
            vocab={localVocab} knownTerms={knownTerms} onToggleKnown={toggleKnown}
            activeCueId={activeIdx >= 0 ? localCues[activeIdx].id : null} activeIdx={activeIdx}
            editMode={editMode}
            onAdd={(term, reading, meaning) => activeIdx >= 0 && addVocab(localCues[activeIdx].id, term, reading, meaning)}
            onRemove={removeVocab}
            reviewTerms={reviewTerms} onEnroll={enrollTerm} onEnrollAll={enrollLesson} enrollableCount={enrollable.length}
          />
        </div>
      </div>

      {toast && (
        <div role="status" data-testid="study-toast" className="fixed bottom-[96px] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-sm text-page shadow-card lg:bottom-6">
          {toast}
        </div>
      )}
      <MobileDock {...controls} />
    </main>
  );
}
