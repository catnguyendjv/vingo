"use client";
import { useState } from "react";
import type { VocabRow } from "@/lib/types";
import { Flashcard } from "@/components/ui/Flashcard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";

export function VocabPanel({
  vocab, knownTerms, onToggleKnown, activeCueId, activeIdx, editMode, onAdd, onRemove,
  reviewTerms, onEnroll, onEnrollAll, enrollableCount,
}: {
  vocab: VocabRow[]; knownTerms: Set<string>;
  onToggleKnown: (term: string, reading: string | null, meaning: string | null) => void;
  /** SRS: từ đang có card hoạt động; enroll per-từ và cả bài (số từ còn enroll được). */
  reviewTerms: Set<string>; onEnroll: (v: VocabRow) => void; onEnrollAll: () => void; enrollableCount: number;
  activeCueId: string | null; activeIdx: number;
  editMode: boolean;
  onAdd: (term: string, reading: string, meaning: string) => void;
  onRemove: (id: string) => void;
}) {
  const [hideKnown, setHideKnown] = useState(false);
  const [tab, setTab] = useState<"cue" | "all">("cue");
  const [newTerm, setNewTerm] = useState("");
  const [newReading, setNewReading] = useState("");
  const [newMeaning, setNewMeaning] = useState("");

  const visible = vocab.filter((v) => !hideKnown || !knownTerms.has(v.term));
  const current = visible.filter((v) => v.cue_id === activeCueId);

  const card = (v: VocabRow, size: "sm" | "lg") => (
    <Flashcard
      key={v.id} term={v.term} reading={v.reading} meaning={v.meaning} size={size}
      known={knownTerms.has(v.term)} current={v.cue_id === activeCueId} editable={editMode}
      onToggleKnown={() => onToggleKnown(v.term, v.reading, v.meaning)}
      onRemove={() => onRemove(v.id)}
      inReview={reviewTerms.has(v.term)} onEnroll={() => onEnroll(v)}
    />
  );
  const empty = <p className="text-sm text-muted">Câu này chưa có từ vựng.</p>;
  const sectionTitle = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted";

  return (
    <section data-testid="vocab-panel" className="rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">
          Từ vựng <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-muted">{vocab.length}</span>
        </h2>
        <div className="hidden lg:block">
          <SegmentedControl
            ariaLabel="Phạm vi từ vựng" tight value={tab} onChange={setTab}
            items={[{ value: "cue", label: `Câu này · ${current.length}` }, { value: "all", label: `Tất cả · ${visible.length}` }]}
          />
        </div>
        <span className="ml-auto flex items-center gap-1.5">
          <Button variant="soft" size="sm" data-testid="enroll-all" disabled={enrollableCount === 0} onClick={onEnrollAll} title="Đưa mọi từ chưa thuộc, chưa ôn vào ôn tập">
            <Icon name="flip" className="size-4" />
            Ôn tập cả bài{enrollableCount > 0 && <span className="tabular-nums text-muted">· {enrollableCount}</span>}
          </Button>
          <Button variant="ghost" size="sm" pressed={hideKnown} onClick={() => setHideKnown((h) => !h)}>
            <Icon name={hideKnown ? "eye" : "eye-off"} className="size-4" />
            {hideKnown ? "Hiện" : "Ẩn"} từ thuộc
          </Button>
        </span>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {/* Desktop: theo tab */}
        <div className="hidden lg:block">
          {tab === "cue" ? (
            current.length ? (
              <div className="flex flex-wrap gap-2">{current.map((v) => card(v, "sm"))}</div>
            ) : (
              <p className="text-sm text-muted">
                Câu này chưa có từ vựng.{" "}
                <button type="button" className="font-medium text-accent underline" onClick={() => setTab("all")}>Xem tất cả</button>
              </p>
            )
          ) : (
            <div className="flex flex-wrap gap-2">{visible.map((v) => card(v, "sm"))}</div>
          )}
        </div>

        {/* Mobile: câu đang phát (thẻ lớn) + cả bài */}
        <div className="flex flex-col gap-4 lg:hidden">
          <div>
            <p className={sectionTitle}>Câu đang phát{activeIdx >= 0 && ` · #${activeIdx + 1}`}</p>
            {current.length ? <div className="flex flex-col gap-2">{current.map((v) => card(v, "lg"))}</div> : empty}
          </div>
          <div>
            <p className={sectionTitle}>Cả bài · {visible.length}</p>
            <div className="flex flex-wrap gap-2">{visible.map((v) => card(v, "sm"))}</div>
          </div>
        </div>

        {editMode && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <p className={sectionTitle}>Thêm từ vào câu đang phát</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input lang="ja" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="単語" className="w-32 [&>input]:h-10 [&>input]:font-jp" />
              <Input lang="ja" value={newReading} onChange={(e) => setNewReading(e.target.value)} placeholder="cách đọc" className="w-32 [&>input]:h-10 [&>input]:font-jp" />
              <Input value={newMeaning} onChange={(e) => setNewMeaning(e.target.value)} placeholder="nghĩa" className="w-40 [&>input]:h-10" />
              <Button
                variant="primary" size="sm"
                disabled={activeCueId == null || !newTerm || !newMeaning}
                onClick={() => { onAdd(newTerm, newReading, newMeaning); setNewTerm(""); setNewReading(""); setNewMeaning(""); }}
              >
                <Icon name="plus" className="size-4" />Thêm vào câu {activeIdx >= 0 ? `#${activeIdx + 1}` : ""}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
