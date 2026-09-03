"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type DictEntry = {
  lang: string; term: string; reading: string | null; meaning: string | null;
  occurrences: number; lesson_ids: string[]; cue_ids: string[]; is_known: boolean;
};

export function DictionaryTable({ entries }: { entries: DictEntry[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "known" | "unknown">("all");
  const [known, setKnown] = useState<Set<string>>(new Set(entries.filter((e) => e.is_known).map((e) => `${e.lang}:${e.term}`)));

  const rows = useMemo(() => entries.filter((e) => {
    const k = known.has(`${e.lang}:${e.term}`);
    if (filter === "known" && !k) return false;
    if (filter === "unknown" && k) return false;
    const s = q.trim().toLowerCase();
    return !s || [e.term, e.reading, e.meaning].some((f) => f?.toLowerCase().includes(s));
  }), [entries, q, filter, known]);

  const toggleKnown = async (e: DictEntry) => {
    const key = `${e.lang}:${e.term}`;
    const next = new Set(known);
    const { data: { user } } = await supabase.auth.getUser();
    if (next.has(key)) {
      next.delete(key); setKnown(next);
      await supabase.from("known_words").delete().match({ lang: e.lang, term: e.term });
    } else {
      next.add(key); setKnown(next);
      await supabase.from("known_words").upsert({ user_id: user!.id, lang: e.lang, term: e.term, reading: e.reading, meaning: e.meaning });
    }
  };

  const exportCsv = () => {
    const esc = (s: string | null) => `"${(s ?? "").replaceAll('"', '""')}"`;
    const csv = ["term,reading,meaning,occurrences,known",
      ...rows.map((e) => [esc(e.term), esc(e.reading), esc(e.meaning), e.occurrences, known.has(`${e.lang}:${e.term}`)].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = "vingo-dictionary.csv";
    a.click();
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm 単語 / cách đọc / nghĩa" className="rounded border p-2" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded border p-2">
          <option value="all">Tất cả</option><option value="unknown">Chưa thuộc</option><option value="known">Đã thuộc</option>
        </select>
        <button onClick={exportCsv} className="rounded border px-3 py-2">⭳ CSV</button>
        <span className="text-gray-500">{rows.length} từ</span>
      </div>
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b text-xs text-gray-500">
          <th className="p-2">✓</th><th className="p-2">単語</th><th className="p-2">Cách đọc</th>
          <th className="p-2">Nghĩa</th><th className="p-2">×N</th><th className="p-2">Câu</th>
        </tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={`${e.lang}:${e.term}`} className="border-b">
              <td className="p-2"><input type="checkbox" checked={known.has(`${e.lang}:${e.term}`)} onChange={() => toggleKnown(e)} /></td>
              <td className={`p-2 ${known.has(`${e.lang}:${e.term}`) ? "text-gray-400 line-through" : ""}`}>{e.term}</td>
              <td className="p-2">{e.reading}</td><td className="p-2">{e.meaning}</td>
              <td className="p-2">×{e.occurrences}</td>
              <td className="p-2"><a className="text-blue-600" href={`/lessons/${e.lesson_ids[0]}#cueid=${e.cue_ids[0]}`}>mở câu</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
