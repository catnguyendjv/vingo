import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getVideoUrl } from "@/lib/video";
import StudyView from "@/components/study/StudyView";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: lesson } = await supabase.from("lessons").select("*").eq("id", id).is("deleted_at", null).single();
  if (!lesson) notFound();
  const [{ data: cues }, { data: vocab }, { data: progress }, { data: known }] = await Promise.all([
    supabase.from("cues").select("*").eq("lesson_id", id).order("idx"),
    supabase.from("vocab_items").select("*").eq("lesson_id", id).order("sort"),
    supabase.from("cue_progress").select("cue_id").eq("lesson_id", id).eq("user_id", user!.id),
    supabase.from("known_words").select("term").eq("lang", lesson.source_lang).eq("user_id", user!.id),
  ]);
  const videoUrl = await getVideoUrl(supabase, lesson);
  return (
    <StudyView
      lesson={lesson} cues={cues ?? []} vocab={vocab ?? []} videoUrl={videoUrl}
      initialDoneCueIds={(progress ?? []).map((p) => p.cue_id)}
      initialKnownTerms={(known ?? []).map((k) => k.term)}
      canEdit={lesson.owner_id === user!.id}
      userId={user!.id}
    />
  );
}
