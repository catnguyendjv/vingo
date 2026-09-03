import { createServerSupabase } from "@/lib/supabase/server";
import { getThumbUrl } from "@/lib/video";
import type { LessonRow } from "@/lib/types";
import { LessonCard } from "@/components/library/LessonCard";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "mine" } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase.from("lessons").select("*").is("deleted_at", null).order("lesson_date", { ascending: false });
  query = tab === "community"
    ? query.eq("visibility", "community").eq("status", "ready")
    : query.eq("owner_id", user!.id);
  const { data: lessons } = await query;
  const withThumbs = await Promise.all(
    (lessons ?? []).map(async (l: LessonRow) => ({ lesson: l, thumb: await getThumbUrl(supabase, l) })),
  );
  return (
    <main>
      <div className="mb-4 flex gap-2 text-sm">
        <a href="/?tab=mine" className={`rounded px-3 py-1 ${tab !== "community" ? "bg-black text-white" : "border"}`}>Của tôi</a>
        <a href="/?tab=community" className={`rounded px-3 py-1 ${tab === "community" ? "bg-black text-white" : "border"}`}>Cộng đồng</a>
      </div>
      {withThumbs.length === 0 && <p className="text-gray-500">Chưa có bài học nào.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {withThumbs.map(({ lesson, thumb }) => <LessonCard key={lesson.id} lesson={lesson} thumbUrl={thumb} />)}
      </div>
    </main>
  );
}
