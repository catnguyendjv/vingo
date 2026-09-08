import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getVideoUrl } from "@/lib/video";
import StudyView from "@/components/study/StudyView";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: lesson } = await supabase.from("lessons").select("*").eq("id", id).is("deleted_at", null).single();
  if (!lesson) notFound();
  const [{ data: cues }, { data: vocab }, { data: progress }, { data: known }, { data: review }] = await Promise.all([
    supabase.from("cues").select("*").eq("lesson_id", id).order("idx"),
    supabase.from("vocab_items").select("*").eq("lesson_id", id).order("sort"),
    supabase.from("cue_progress").select("cue_id").eq("lesson_id", id).eq("user_id", user.id),
    supabase.from("known_words").select("term").eq("lang", lesson.source_lang).eq("user_id", user.id),
    supabase.from("review_cards").select("term").eq("lang", lesson.source_lang).eq("user_id", user.id).eq("suspended", false),
  ]);
  const videoUrl = await getVideoUrl(supabase, lesson, user.id);
  return (
    <StudyView
      lesson={lesson} cues={cues ?? []} vocab={vocab ?? []} videoUrl={videoUrl}
      initialDoneCueIds={(progress ?? []).map((p) => p.cue_id)}
      initialKnownTerms={(known ?? []).map((k) => k.term)}
      initialReviewTerms={(review ?? []).map((r) => r.term)}
      canEdit={lesson.owner_id === user.id}
      userId={user.id}
    />
  );
}
