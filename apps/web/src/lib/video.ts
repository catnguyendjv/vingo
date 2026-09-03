import type { SupabaseClient } from "@supabase/supabase-js";
import type { LessonRow } from "./types";

const SIGNED_TTL_SECONDS = 2 * 60 * 60;

export async function getVideoUrl(supabase: SupabaseClient, lesson: LessonRow): Promise<string | null> {
  if (lesson.video_provider !== "storage" || !lesson.video_ref) return null;
  const { data, error } = await supabase.storage.from("videos")
    .createSignedUrl(lesson.video_ref, SIGNED_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

export async function getThumbUrl(supabase: SupabaseClient, lesson: LessonRow): Promise<string | null> {
  if (lesson.video_provider === "youtube" && lesson.video_ref)
    return `https://i.ytimg.com/vi/${lesson.video_ref}/hqdefault.jpg`;
  if (!lesson.thumb_path) return null;
  const { data, error } = await supabase.storage.from("videos")
    .createSignedUrl(lesson.thumb_path, SIGNED_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}
