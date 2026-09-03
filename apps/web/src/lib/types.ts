export type LessonRow = {
  id: string; owner_id: string; title: string; lesson_date: string | null;
  source_type: "zoom" | "youtube" | "upload"; source_lang: string; target_lang: string;
  video_provider: "storage" | "youtube" | null; video_ref: string | null;
  duration_sec: number | null; thumb_path: string | null;
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
