import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { DictionaryTable, type DictEntry } from "@/components/dictionary/DictionaryTable";

// PostgREST cắt tối đa `max_rows` (1000 mặc định) mỗi lần gọi, kể cả RPC. Từ điển đã vượt 1000 từ
// nên nạp theo trang, có ORDER BY ổn định (lang, term) để các trang không chồng/lọt.
const PAGE = 1000;
async function loadDictionary(supabase: SupabaseClient): Promise<DictEntry[]> {
  const out: DictEntry[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .rpc("my_dictionary")
      .order("lang").order("term")
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    out.push(...(data as DictEntry[]));
    if (data.length < PAGE) break;
  }
  return out;
}

export default async function DictionaryPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const entries = await loadDictionary(supabase);
  return (
    <main>
      <h1 className="mb-4 flex items-baseline gap-2">
        <span lang="ja" className="font-jp text-base font-medium text-muted">単語帳</span>
        <span className="text-[22px] font-bold tracking-[-0.02em]">Từ điển</span>
      </h1>
      <DictionaryTable entries={entries} userId={user.id} />
    </main>
  );
}
