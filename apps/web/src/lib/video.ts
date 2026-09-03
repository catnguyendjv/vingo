import type { SupabaseClient } from "@supabase/supabase-js";
import type { LessonRow } from "./types";

const SIGNED_TTL_SECONDS = 2 * 60 * 60;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Cache theo `${userId}:${path}` — bắt buộc keyed theo user để không lộ signed URL
// của người khác trước khi permission (RLS storage policy) của chính user đó được kiểm tra.
const urlCache = new Map<string, { url: string; expiresAt: number }>();

async function cachedSignedUrl(
  supabase: SupabaseClient,
  userId: string,
  path: string,
): Promise<string | null> {
  const key = `${userId}:${path}`;
  const cached = urlCache.get(key);
  if (cached && Date.now() < cached.expiresAt - REFRESH_MARGIN_MS) return cached.url;
  const { data, error } = await supabase.storage.from("videos").createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error) return null;
  urlCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_TTL_SECONDS * 1000 });
  return data.signedUrl;
}

export async function getVideoUrl(supabase: SupabaseClient, lesson: LessonRow, userId: string): Promise<string | null> {
  if (lesson.video_provider !== "storage" || !lesson.video_ref) return null;
  return cachedSignedUrl(supabase, userId, lesson.video_ref);
}

export async function getThumbUrl(supabase: SupabaseClient, lesson: LessonRow, userId: string): Promise<string | null> {
  if (lesson.video_provider === "youtube" && lesson.video_ref)
    return `https://i.ytimg.com/vi/${lesson.video_ref}/hqdefault.jpg`;
  if (!lesson.thumb_path) return null;
  return cachedSignedUrl(supabase, userId, lesson.thumb_path);
}
