"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createReviewApi } from "@/lib/review-api";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Checkbox } from "@/components/ui/Checkbox";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Icon } from "@/components/ui/Icon";

export type DictEntry = {
  lang: string; term: string; reading: string | null; meaning: string | null;
  occurrences: number; lesson_ids: string[]; cue_ids: string[]; is_known: boolean; in_review: boolean;
};
type Filter = "all" | "unknown" | "known";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" }, { value: "unknown", label: "Chưa thuộc" }, { value: "known", label: "Đã thuộc" },
];

export function DictionaryTable({ entries, userId }: { entries: DictEntry[]; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const keyOf = (e: DictEntry) => `${e.lang}:${e.term}`;
  const [known, setKnown] = useState<Set<string>>(new Set(entries.filter((e) => e.is_known).map(keyOf)));
  const [inReview, setInReview] = useState<Set<string>>(new Set(entries.filter((e) => e.in_review).map(keyOf)));
  const [notice, setNotice] = useState<string | null>(null);
  const reviewApi = useMemo(() => createReviewApi(supabase), [supabase]);

  const rows = useMemo(() => entries.filter((e) => {
    const k = known.has(keyOf(e));
    if (filter === "known" && !k) return false;
    if (filter === "unknown" && k) return false;
    const s = q.trim().toLowerCase();
    return !s || [e.term, e.reading, e.meaning].some((f) => f?.toLowerCase().includes(s));
  }), [entries, q, filter, known]);

  const toggleKnown = async (e: DictEntry) => {
    const key = keyOf(e);
    const next = new Set(known);
    if (next.has(key)) {
      next.delete(key); setKnown(next);
      await supabase.from("known_words").delete().match({ lang: e.lang, term: e.term });
    } else {
      next.add(key); setKnown(next);
      // Trigger DB suspend card SRS → bỏ chip "Đang ôn" ngay.
      setInReview((s) => { const n = new Set(s); n.delete(key); return n; });
      await supabase.from("known_words").upsert({ user_id: userId, lang: e.lang, term: e.term, reading: e.reading, meaning: e.meaning });
    }
  };

  // SRS: đưa 1 từ vào ôn tập (RPC tự gỡ known_words; first-wins nếu card đã có).
  const enroll = async (e: DictEntry) => {
    const key = keyOf(e);
    setInReview((s) => new Set(s).add(key));
    setKnown((s) => { const n = new Set(s); n.delete(key); return n; });
    setNotice(null);
    try {
      await reviewApi.enroll([{
        lang: e.lang, term: e.term, reading: e.reading, meaning: e.meaning,
        lesson_id: e.lesson_ids[0] ?? null, cue_id: e.cue_ids[0] ?? null,
      }]);
    } catch (err) {
      setInReview((s) => { const n = new Set(s); n.delete(key); return n; });
      setNotice(`Không đưa được vào ôn tập: ${(err as Error).message}`);
    }
  };
  const reviewCell = (e: DictEntry) => inReview.has(keyOf(e)) ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
      <Icon name="flip" className="size-3" />Đang ôn
    </span>
  ) : (
    <Button size="sm" variant="soft" data-testid="dict-enroll" onClick={() => enroll(e)} className="min-h-[28px] px-2.5 text-[12px]">
      <Icon name="flip" className="size-3.5" />Ôn tập
    </Button>
  );

  const exportCsv = () => {
    const esc = (s: string | null) => `"${(s ?? "").replaceAll('"', '""')}"`;
    const csv = ["term,reading,meaning,occurrences,known",
      ...rows.map((e) => [esc(e.term), esc(e.reading), esc(e.meaning), e.occurrences, known.has(keyOf(e))].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv" }));
    a.download = "vingo-dictionary.csv";
    a.click();
  };

  const openHref = (e: DictEntry) => `/lessons/${e.lesson_ids[0]}#cueid=${e.cue_ids[0]}`;
  const countPill = <span className="whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-muted">{rows.length} từ</span>;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input icon="search" aria-label="Tìm từ" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm 単語 / cách đọc / nghĩa" className="w-full md:max-w-[380px]" />
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl ariaLabel="Lọc theo trạng thái" tight value={filter} onChange={setFilter} items={FILTERS} />
          <span className="md:hidden">{countPill}</span>
          <IconButton label="Tải CSV" onClick={exportCsv} className="md:hidden"><Icon name="download" className="size-[18px]" /></IconButton>
          <span className="hidden md:inline-flex">
            <Button onClick={exportCsv}><Icon name="download" className="size-[17px]" />CSV</Button>
          </span>
          <span className="ml-auto hidden md:inline">{countPill}</span>
        </div>
      </div>

      {notice && <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">{notice}</p>}

      {/* Desktop: bảng */}
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
        <table data-testid="dict-table" className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-[11.5px] uppercase tracking-[.06em] text-muted">
            <tr>
              <th className="w-12 px-4 py-2.5"><span className="sr-only">Đã thuộc</span>✓</th>
              <th className="px-3 py-2.5" lang="ja">単語</th><th className="px-3 py-2.5">Cách đọc</th>
              <th className="px-3 py-2.5">Nghĩa</th><th className="px-3 py-2.5">×N</th><th className="px-3 py-2.5">Câu</th>
              <th className="px-3 py-2.5">Ôn tập</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const k = known.has(keyOf(e));
              return (
                <tr key={keyOf(e)} data-term={e.term} className="border-t border-line transition-colors hover:bg-surface-2">
                  <td className="px-4 py-2.5"><Checkbox round checked={k} onChange={() => toggleKnown(e)} label={`${e.term}: ${k ? "bỏ đánh dấu đã thuộc" : "đánh dấu đã thuộc"}`} /></td>
                  <td lang="ja" className={cn("px-3 py-2.5 font-jp text-base font-medium", k && "line-through text-muted")}>{e.term}</td>
                  <td lang="ja" className="px-3 py-2.5 font-jp text-muted">{e.reading}</td>
                  <td className="px-3 py-2.5">{e.meaning}</td>
                  <td className="px-3 py-2.5"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums">×{e.occurrences}</span></td>
                  <td className="px-3 py-2.5">
                    <a className="inline-flex items-center gap-1 font-medium text-accent hover:underline" href={openHref(e)}>
                      mở câu<Icon name="arrow-up-right" className="size-3.5" />
                    </a>
                  </td>
                  <td className="px-3 py-2">{reviewCell(e)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: thẻ */}
      <ul data-testid="dict-list" className="flex flex-col gap-2.5 md:hidden">
        {rows.map((e) => {
          const k = known.has(keyOf(e));
          return (
            <li key={keyOf(e)} data-term={e.term} className="flex gap-3 rounded-lg border border-line bg-surface p-3">
              <Checkbox round size="lg" checked={k} onChange={() => toggleKnown(e)} label={`${e.term}: ${k ? "bỏ đánh dấu đã thuộc" : "đánh dấu đã thuộc"}`} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p lang="ja" className="font-jp text-[17px] font-medium leading-tight">
                  <span className={cn(k && "line-through text-muted")}>{e.term}</span>
                  {e.reading && <span className="ml-2 text-xs font-normal text-muted">{e.reading}</span>}
                </p>
                {e.meaning && <p className="mt-1 text-sm leading-snug">{e.meaning}</p>}
                <p className="mt-2 flex items-center gap-3 text-xs">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 tabular-nums text-muted">×{e.occurrences}</span>
                  <a className="inline-flex items-center gap-1 font-medium text-accent" href={openHref(e)}>mở câu<Icon name="arrow-up-right" className="size-3.5" /></a>
                  <span className="ml-auto">{reviewCell(e)}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="py-10 text-center text-sm text-muted">Không có từ nào khớp.</p>}
    </div>
  );
}
