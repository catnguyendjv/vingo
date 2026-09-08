import { lessonJsonSchema, type LessonJson } from "@vingo/shared";
import type { CoreContext } from "./context.js";

export interface LessonSummary {
  id: string;
  title: string;
  status: string;
  visibility: string;
  created_at: string;
}

export interface CreateLessonResult {
  lesson_id: string;
  already_exists: boolean;
  /** Gợi ý bước video kế tiếp (đường A/B, hoặc youtube không cần video). Có khi tạo/thay mới. */
  video_next_step?: string;
  /** Lý do không đè (khi already_exists = true và bài đang ready/processing). */
  message?: string;
}

export interface IngestStatus {
  status: string;
  ingest_error: string | null;
}

// Bài của user (chống tạo trùng, tra cứu). RLS chỉ trả bài đọc được; lọc thêm owner + chưa xoá.
export async function listLessons(ctx: CoreContext): Promise<LessonSummary[]> {
  const { data, error } = await ctx.supabase
    .from("lessons")
    .select("id, title, status, visibility, created_at")
    .eq("owner_id", ctx.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listLessons: ${error.message}`);
  return (data ?? []) as LessonSummary[];
}

function videoNextStep(lesson: LessonJson): string {
  if (lesson.video_provider === "youtube") return "youtube — không cần video, bài đã sẵn sàng.";
  if (lesson.video_provider === "local")
    return "local — không upload; bài đã sẵn sàng. Người học mở bài trên web, bấm 'Chọn video trên máy' và trỏ tới file gốc.";
  return [
    "Cần đưa video để bài sang ready:",
    "• Đường A (ưu tiên): có direct-download link → ingest_video_from_url.",
    "• Đường B: file local → request_video_upload → curl PUT → finalize_lesson.",
  ].join("\n");
}

// Idempotent theo spec master §4.2 + P1 §3.1:
// - id chưa có → insert lessons + cues + vocab.
// - id đã có, status ∈ {draft, error} → thay toàn bộ cues/vocab (giữ owner).
// - id đã có, status ∈ {ready, processing} → không đè.
export async function createLesson(ctx: CoreContext, input: unknown): Promise<CreateLessonResult> {
  const lesson = lessonJsonSchema.parse(input);

  const { data: existing, error: exErr } = await ctx.supabase
    .from("lessons")
    .select("id, status, owner_id")
    .eq("id", lesson.id)
    .maybeSingle();
  if (exErr) throw new Error(`createLesson lookup: ${exErr.message}`);

  if (existing) {
    if (existing.owner_id !== ctx.userId) {
      // RLS thường chặn trước; guard rõ ràng phòng bài community đọc được.
      throw new Error("createLesson: bài này không thuộc sở hữu của bạn.");
    }
    if (existing.status === "ready" || existing.status === "processing") {
      return {
        lesson_id: lesson.id,
        already_exists: true,
        message: `Bài đã ở trạng thái '${existing.status}', không ghi đè. Sửa nội dung trên web.`,
      };
    }
    // draft/error → thay toàn bộ. Xoá cues (composite FK ON DELETE CASCADE dọn vocab).
    const { error: delErr } = await ctx.supabase.from("cues").delete().eq("lesson_id", lesson.id);
    if (delErr) throw new Error(`createLesson clear cues: ${delErr.message}`);
    const { error: upErr } = await ctx.supabase
      .from("lessons")
      .update(lessonRow(lesson))
      .eq("id", lesson.id);
    if (upErr) throw new Error(`createLesson update: ${upErr.message}`);
  } else {
    const { error: insErr } = await ctx.supabase
      .from("lessons")
      .insert({ id: lesson.id, owner_id: ctx.userId, ...lessonRow(lesson) });
    if (insErr) throw new Error(`createLesson insert lesson: ${insErr.message}`);
  }

  // cues → vocab (thứ tự để composite FK vocab(cue_id,lesson_id) hợp lệ).
  const { error: cueErr } = await ctx.supabase.from("cues").insert(
    lesson.cues.map((c) => ({
      id: c.id,
      lesson_id: lesson.id,
      idx: c.idx,
      start_ms: c.start_ms,
      end_ms: c.end_ms,
      text_source: c.text_source,
      text_target: c.text_target ?? null,
      uncertain: c.uncertain ?? false,
      note: c.note ?? null,
    })),
  );
  if (cueErr) throw new Error(`createLesson insert cues: ${cueErr.message}`);

  if (lesson.vocab.length > 0) {
    const { error: vErr } = await ctx.supabase.from("vocab_items").insert(
      lesson.vocab.map((v) => ({
        id: v.id,
        lesson_id: lesson.id,
        cue_id: v.cue_id,
        term: v.term,
        reading: v.reading ?? null,
        meaning: v.meaning,
        sort: v.sort ?? null,
      })),
    );
    if (vErr) throw new Error(`createLesson insert vocab: ${vErr.message}`);
  }

  return { lesson_id: lesson.id, already_exists: false, video_next_step: videoNextStep(lesson) };
}

// Cột lessons suy từ lesson JSON. youtube/local → ready ngay (youtube: web derive thumbnail;
// local: người học tự chọn file trên web); còn lại → draft.
function lessonRow(lesson: LessonJson) {
  const readyNow = lesson.video_provider === "youtube" || lesson.video_provider === "local";
  return {
    title: lesson.title,
    lesson_date: lesson.lesson_date ?? null,
    source_type: lesson.source_type,
    source_ref: lesson.source_ref ?? null,
    source_lang: lesson.source_lang,
    target_lang: lesson.target_lang,
    video_provider: lesson.video_provider ?? null,
    video_ref: lesson.video_ref ?? null,
    duration_sec: lesson.duration_sec ?? null,
    video_size_bytes: lesson.video_size_bytes ?? null,
    status: readyNow ? "ready" : "draft",
    ingest_error: null,
  };
}

export async function getIngestStatus(ctx: CoreContext, lessonId: string): Promise<IngestStatus> {
  const { data, error } = await ctx.supabase
    .from("lessons")
    .select("status, ingest_error")
    .eq("id", lessonId)
    .maybeSingle();
  if (error) throw new Error(`getIngestStatus: ${error.message}`);
  if (!data) throw new Error("getIngestStatus: không tìm thấy bài (hoặc không có quyền).");
  return { status: data.status, ingest_error: data.ingest_error };
}
