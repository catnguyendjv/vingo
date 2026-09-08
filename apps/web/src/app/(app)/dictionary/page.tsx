import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { DictionaryTable, type DictEntry } from "@/components/dictionary/DictionaryTable";

// PostgREST cắt mỗi response ở `max_rows` (mặc định 1000, cloud có thể đặt khác), kể cả RPC.
// Nạp theo trang với ORDER BY ổn định (lang, term); con trỏ dời theo số dòng THỰC NHẬN và chỉ dừng
// khi trang rỗng → đúng với mọi giá trị max_rows, không cần nhớ cấu hình server.
const PAGE = 1000;
const MAX_PAGES = 50; // chốt an toàn: 50k từ
async function loadDictionary(supabase: SupabaseClient): Promise<DictEntry[]> {
  const out: DictEntry[] = [];
  let from = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await supabase
      .rpc("my_dictionary")
      .order("lang").order("term")
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    out.push(...(data as DictEntry[]));
    from += data.length;
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
