import type { CoreContext } from "./context.js";

export interface KnownWord {
  term: string;
  reading: string | null;
  meaning: string | null;
}

// Từ đã thuộc theo ngôn ngữ — skill loại khỏi vocab bài mới. RLS giới hạn user_id = mình.
export async function getKnownWords(ctx: CoreContext, lang: string): Promise<KnownWord[]> {
  const { data, error } = await ctx.supabase
    .from("known_words")
    .select("term, reading, meaning")
    .eq("lang", lang)
    .order("marked_at", { ascending: false });
  if (error) throw new Error(`getKnownWords: ${error.message}`);
  return (data ?? []) as KnownWord[];
}
