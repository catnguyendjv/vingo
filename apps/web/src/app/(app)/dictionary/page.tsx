import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { DictionaryTable, type DictEntry } from "@/components/dictionary/DictionaryTable";

export default async function DictionaryPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("my_dictionary");
  return (
    <main>
      <h1 className="mb-4 flex items-baseline gap-2">
        <span lang="ja" className="font-jp text-base font-medium text-muted">単語帳</span>
        <span className="text-[22px] font-bold tracking-[-0.02em]">Từ điển</span>
      </h1>
      <DictionaryTable entries={(data ?? []) as DictEntry[]} userId={user.id} />
    </main>
  );
}
