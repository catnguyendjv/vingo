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
      <h1 className="mb-4 text-xl font-bold">単語帳 — Từ điển</h1>
      <DictionaryTable entries={(data ?? []) as DictEntry[]} userId={user.id} />
    </main>
  );
}
