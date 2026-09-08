export type LessonRow = {
  id: string; owner_id: string; title: string; lesson_date: string | null;
  source_type: "zoom" | "youtube" | "upload"; source_lang: string; target_lang: string;
  video_provider: "storage" | "youtube" | "local" | null; video_ref: string | null;
  duration_sec: number | null; video_size_bytes: number | null; thumb_path: string | null;
  status: "draft" | "processing" | "ready" | "error"; ingest_error: string | null;
  visibility: "private" | "community"; deleted_at: string | null;
};
export type CueRow = {
  id: string; lesson_id: string; idx: number; start_ms: number; end_ms: number;
  text_source: string; text_target: string | null; uncertain: boolean; note: string | null;
};
export type VocabRow = {
  id: string; lesson_id: string; cue_id: string; term: string;
  reading: string | null; meaning: string | null; sort: number | null;
};

// ---- SRS (P1.5) ----
export type StateName = "New" | "Learning" | "Review" | "Relearning";
export type CardRow = {
  id: string; lang: string; term: string; reading: string | null; meaning: string | null;
  due_at: string; stability: number | null; difficulty: number | null;
  scheduled_days: number | null; learning_steps: number | null; reps: number; lapses: number;
  state: StateName; last_review_at: string | null; created_at: string;
};
/** Một dòng của RPC review_queue(): card + ngữ cảnh câu ví dụ (null nếu bài đã xoá/mất quyền). */
export type QueueRow = CardRow & {
  source_lesson_id: string | null; lesson_title: string | null; source_cue_id: string | null;
  cue_idx: number | null; cue_text_source: string | null; cue_text_target: string | null;
};
export type ReviewStats = { due: number; new_available: number; new_last_24h: number; next_due_at: string | null };
export type EnrollItem = {
  lang: string; term: string; reading: string | null; meaning: string | null;
  lesson_id: string | null; cue_id: string | null;
};
/** Các cột lịch FSRS client tính và gửi cho RPC review_card / undo_review (p_card). */
export type CardPatch = {
  due_at: string; stability: number; difficulty: number; scheduled_days: number; learning_steps: number;
  reps: number; lapses: number; state: StateName; last_review_at: string | null;
};
