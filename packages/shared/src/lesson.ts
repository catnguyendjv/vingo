import { z } from "zod";

export const cueInputSchema = z.object({
  id: z.string().uuid(),
  idx: z.number().int().min(1),
  start_ms: z.number().int().min(0),
  end_ms: z.number().int().min(0),
  text_source: z.string().min(1),
  text_target: z.string().optional(),
  uncertain: z.boolean().optional(),
  note: z.string().optional(),
}).refine((c) => c.start_ms < c.end_ms, { message: "start_ms must be < end_ms" });

export const vocabInputSchema = z.object({
  id: z.string().uuid(),
  cue_id: z.string().uuid(),
  term: z.string().min(1),
  reading: z.string().optional(),
  meaning: z.string().min(1),
  sort: z.number().int().optional(),
});

export const lessonJsonSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  lesson_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source_type: z.enum(["zoom", "youtube", "upload"]),
  source_ref: z.string().optional(),
  source_lang: z.string().min(2),
  target_lang: z.string().min(2),
  video_provider: z.enum(["storage", "youtube", "local"]).optional(),
  video_ref: z.string().optional(),
  duration_sec: z.number().int().positive().optional(),
  video_size_bytes: z.number().int().positive().optional(),
  cues: z.array(cueInputSchema).min(1),
  vocab: z.array(vocabInputSchema),
}).superRefine((l, ctx) => {
  const ids = new Set<string>(); const idxs = new Set<number>();
  for (const c of l.cues) {
    if (ids.has(c.id)) ctx.addIssue({ code: "custom", message: `duplicate cue id ${c.id}` });
    if (idxs.has(c.idx)) ctx.addIssue({ code: "custom", message: `duplicate cue idx ${c.idx}` });
    ids.add(c.id); idxs.add(c.idx);
  }
  for (const v of l.vocab) {
    if (!ids.has(v.cue_id)) ctx.addIssue({ code: "custom", message: `unknown cue_id ${v.cue_id} in vocab ${v.term}` });
  }
});

export type CueInput = z.infer<typeof cueInputSchema>;
export type VocabInput = z.infer<typeof vocabInputSchema>;
export type LessonJson = z.infer<typeof lessonJsonSchema>;
