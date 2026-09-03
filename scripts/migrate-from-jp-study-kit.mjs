// Usage (chạy bằng tsx vì import schema TypeScript từ packages/shared):
//   pnpm exec tsx scripts/migrate-from-jp-study-kit.mjs --user <owner-uuid> [--source <dir>] [--videos]
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Idempotent: uuid v5 từ slug → chạy lại không tạo trùng. Không đụng file nguồn.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";
import { lessonJsonSchema } from "../packages/shared/src/lesson.ts";

const NS = "3f2b7a52-9c1d-4d7e-9b0a-111111111111"; // namespace cố định — KHÔNG đổi (đổi là mất idempotency)
const args = process.argv.slice(2);
const get = (flag, dflt) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : dflt; };
const OWNER = get("--user"); if (!OWNER) { console.error("--user <uuid> required"); process.exit(1); }
const SRC = get("--source", "C:\\Users\\cat.nguyen\\Desktop\\study-kit-test\\jp-study-kit");
const WITH_VIDEOS = args.includes("--videos");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const hmsToMs = (s) => { const [h, m, rest] = s.split(":"); const [sec, ms = "0"] = rest.split("."); return ((+h * 60 + +m) * 60 + +sec) * 1000 + +ms.padEnd(3, "0"); };
const id = (...parts) => uuidv5(parts.join(":"), NS);

const lessonsDir = join(SRC, "lessons");
const slugs = readdirSync(lessonsDir).filter((s) => !s.startsWith("_") && existsSync(join(lessonsDir, s, "lesson-data.json")));
console.log(`Found ${slugs.length} lessons`);

const cueCountBySlug = new Map();

for (const slug of slugs) {
  const raw = JSON.parse(readFileSync(join(lessonsDir, slug, "lesson-data.json"), "utf-8"));
  cueCountBySlug.set(slug, raw.cues.length);
  const lessonId = id("lesson", slug);
  const cues = raw.cues.map((c) => ({
    id: id(slug, "cue", c.i), idx: c.i,
    start_ms: hmsToMs(c.start), end_ms: Math.max(hmsToMs(c.end), hmsToMs(c.start) + 1),
    text_source: c.ja, text_target: c.vi ?? undefined,
    uncertain: !!c.uncertain, note: c.note ?? undefined,
  }));
  const vocab = raw.cues.flatMap((c) => (c.vocab ?? []).map((v, j) => ({
    id: id(slug, "vocab", c.i, j), cue_id: id(slug, "cue", c.i),
    term: v.w, reading: v.yomi || undefined, meaning: v.vi, sort: j,
  })));
  const videoFile = raw.meta.video;
  const lesson = lessonJsonSchema.parse({
    id: lessonId, title: raw.meta.title, lesson_date: raw.meta.date,
    source_type: "zoom", source_ref: raw.meta.meeting_id ?? slug,
    source_lang: "ja", target_lang: "vi",
    video_provider: "storage", video_ref: `${OWNER}/${lessonId}/video.mp4`, cues, vocab,
  });

  const { error: le } = await supabase.from("lessons").upsert({
    id: lesson.id, owner_id: OWNER, title: lesson.title, lesson_date: lesson.lesson_date,
    source_type: lesson.source_type, source_ref: lesson.source_ref,
    source_lang: "ja", target_lang: "vi",
    video_provider: "storage", video_ref: lesson.video_ref,
    thumb_path: `${OWNER}/${lessonId}/thumb.jpg`,
    status: WITH_VIDEOS ? "ready" : "draft", visibility: "private",
  });
  if (le) throw new Error(`${slug}: ${le.message}`);
  const { error: ce } = await supabase.from("cues").upsert(lesson.cues.map((c) => ({ ...c, lesson_id: lessonId })));
  if (ce) throw new Error(`${slug} cues: ${ce.message}`);
  const { error: ve } = await supabase.from("vocab_items").upsert(lesson.vocab.map((v) => ({ ...v, lesson_id: lessonId })));
  if (ve) throw new Error(`${slug} vocab: ${ve.message}`);

  if (WITH_VIDEOS) {
    for (const [local, remote, type] of [
      [join(lessonsDir, slug, videoFile), `${OWNER}/${lessonId}/video.mp4`, "video/mp4"],
      [join(lessonsDir, slug, "thumb.jpg"), `${OWNER}/${lessonId}/thumb.jpg`, "image/jpeg"],
    ]) {
      if (!existsSync(local)) { console.warn(`  skip missing ${local}`); continue; }
      console.log(`  uploading ${remote} (${Math.round(statSync(local).size / 1e6)}MB)`);
      const { error } = await supabase.storage.from("videos")
        .upload(remote, readFileSync(local), { contentType: type, upsert: true });
      if (error) throw new Error(`${slug} upload: ${error.message}`);
    }
  }
  console.log(`✔ ${slug}`);
}

// known_words + cue_progress từ study.db.
// FK an toàn: chỉ import dòng trỏ tới bài CÓ trong lần import này (lọc theo slugs),
// dòng mồ côi được đếm và cảnh báo — không throw.
const dbPath = join(SRC, "data", "study.db");
if (existsSync(dbPath)) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const kws = db.prepare("select word, yomi, vi, first_lesson, marked_at from known_words").all();
  if (kws.length) {
    const { error } = await supabase.from("known_words").upsert(kws.map((k) => ({
      user_id: OWNER, lang: "ja", term: k.word, reading: k.yomi || null, meaning: k.vi || null,
      first_lesson_id: k.first_lesson && slugs.includes(k.first_lesson) ? id("lesson", k.first_lesson) : null,
      marked_at: k.marked_at || new Date().toISOString(),
    })));
    if (error) throw new Error(`known_words: ${error.message}`);
    console.log(`✔ ${kws.length} known_words`);
  }
  // lesson_progress.cue là INDEX 0-BASED trong mảng cues (không phải cue.i, vốn bắt đầu từ 1).
  // Vậy cue thứ p.cue trong study.db tương ứng cue.i = p.cue + 1 trong lesson-data.json.
  const prog = db.prepare("select lesson, cue, done_at from lesson_progress").all();
  const inScope = prog.filter((p) => slugs.includes(p.lesson));
  if (prog.length > inScope.length) console.warn(`⚠ bỏ qua ${prog.length - inScope.length} cue_progress của bài không import`);
  const withinRange = inScope.filter((p) => (p.cue + 1) <= cueCountBySlug.get(p.lesson));
  if (inScope.length > withinRange.length) console.warn(`⚠ bỏ qua ${inScope.length - withinRange.length} cue_progress có cue index vượt quá số cue của bài`);
  if (withinRange.length) {
    const rows = withinRange.map((p) => ({
      user_id: OWNER, cue_id: id(p.lesson, "cue", p.cue + 1), lesson_id: id("lesson", p.lesson),
      done_at: p.done_at || new Date().toISOString(),
    }));
    const { error } = await supabase.from("cue_progress").upsert(rows, { ignoreDuplicates: true });
    if (error) throw new Error(`cue_progress: ${error.message}`);
    console.log(`✔ ${withinRange.length} cue_progress`);
  }
  db.close();
}
console.log("Done.");
