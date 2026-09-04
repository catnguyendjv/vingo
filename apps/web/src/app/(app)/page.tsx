import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getThumbUrl } from "@/lib/video";
import type { LessonRow } from "@/lib/types";
import { LessonCard } from "@/components/library/LessonCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/library/EmptyState";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "mine" } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  let query = supabase.from("lessons").select("*").is("deleted_at", null)
    .order("lesson_date", { ascending: false, nullsFirst: false });
  query = tab === "community"
    ? query.eq("visibility", "community").eq("status", "ready")
    : query.eq("owner_id", user.id);
  const { data: lessons } = await query;
  const lessonIds = (lessons ?? []).map((l: LessonRow) => l.id);

  const [{ data: doneRows }, { data: cueRows }] = await Promise.all([
    lessonIds.length
      ? supabase.from("cue_progress").select("lesson_id").eq("user_id", user.id).in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as { lesson_id: string }[] }),
    lessonIds.length
      ? supabase.from("cues").select("lesson_id").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as { lesson_id: string }[] }),
  ]);
  const doneByLesson = new Map<string, number>();
  for (const row of doneRows ?? []) doneByLesson.set(row.lesson_id, (doneByLesson.get(row.lesson_id) ?? 0) + 1);
  const totalByLesson = new Map<string, number>();
  for (const row of cueRows ?? []) totalByLesson.set(row.lesson_id, (totalByLesson.get(row.lesson_id) ?? 0) + 1);

  const withThumbs = await Promise.all(
    (lessons ?? []).map(async (l: LessonRow) => ({
      lesson: l,
      thumb: await getThumbUrl(supabase, l, user.id),
      progress: { done: doneByLesson.get(l.id) ?? 0, total: totalByLesson.get(l.id) ?? 0 },
    })),
  );
  const current = tab === "community" ? "community" : "mine";
  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">Thư viện</h1>
        <SegmentedControl
          ariaLabel="Bộ lọc thư viện"
          value={current}
          items={[
            { value: "mine", label: "Của tôi", href: "/?tab=mine" },
            { value: "community", label: "Cộng đồng", href: "/?tab=community" },
          ]}
        />
      </div>
      {withThumbs.length === 0 ? (
        <EmptyState tab={current} />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {withThumbs.map(({ lesson, thumb, progress }) => (
            <LessonCard key={lesson.id} lesson={lesson} thumbUrl={thumb} progress={progress} />
          ))}
        </div>
      )}
    </main>
  );
}
