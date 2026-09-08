import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLesson, getIngestStatus, listLessons } from "./lessons.js";
import { admin, cleanupUser, createTestUser, ctxFor, makeLesson } from "./_testutil.js";

let userA: string;
let userB: string;

beforeAll(async () => {
  userA = await createTestUser();
  userB = await createTestUser();
});
afterAll(async () => {
  await cleanupUser(userA);
  await cleanupUser(userB);
});

describe("createLesson", () => {
  it("tạo bài mới: cues + vocab được ghi, hiện trong listLessons", async () => {
    const ctx = ctxFor(userA);
    const lesson = makeLesson({ title: "Bài mới" });
    const res = await createLesson(ctx, lesson);
    expect(res.already_exists).toBe(false);
    expect(res.lesson_id).toBe(lesson.id);
    expect(res.video_next_step).toBeTruthy();

    const list = await listLessons(ctx);
    expect(list.find((l) => l.id === lesson.id)?.title).toBe("Bài mới");

    const { count: cueCount } = await admin
      .from("cues")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", lesson.id);
    expect(cueCount).toBe(1);
    const { count: vocabCount } = await admin
      .from("vocab_items")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", lesson.id);
    expect(vocabCount).toBe(1);
  });

  it("idempotent: retry cùng id khi draft → thay toàn bộ cues/vocab", async () => {
    const ctx = ctxFor(userA);
    const lesson = makeLesson({ cueText: "元の文", vocabTerm: "元" });
    await createLesson(ctx, lesson);

    // Thay: cue mới, 2 vocab.
    const cid = crypto.randomUUID();
    const replaced = {
      ...lesson,
      title: "Đã sửa",
      cues: [{ id: cid, idx: 1, start_ms: 0, end_ms: 5000, text_source: "新しい文", text_target: "câu mới" }],
      vocab: [
        { id: crypto.randomUUID(), cue_id: cid, term: "新規A", meaning: "mới A" },
        { id: crypto.randomUUID(), cue_id: cid, term: "新規B", meaning: "mới B" },
      ],
    };
    const res = await createLesson(ctx, replaced);
    expect(res.already_exists).toBe(false);

    const { data: cues } = await admin.from("cues").select("text_source").eq("lesson_id", lesson.id);
    expect(cues).toHaveLength(1);
    expect(cues![0].text_source).toBe("新しい文");
    const { count } = await admin
      .from("vocab_items")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", lesson.id);
    expect(count).toBe(2);
  });

  it("bài ready → không đè, trả already_exists", async () => {
    const ctx = ctxFor(userA);
    const lesson = makeLesson({ title: "Giữ nguyên" });
    await createLesson(ctx, lesson);
    await admin.from("lessons").update({ status: "ready" }).eq("id", lesson.id);

    const res = await createLesson(ctx, { ...lesson, title: "Cố đè" });
    expect(res.already_exists).toBe(true);
    expect(res.message).toContain("ready");

    const { data } = await admin.from("lessons").select("title").eq("id", lesson.id).single();
    expect(data!.title).toBe("Giữ nguyên");
  });

  it("youtube → status ready ngay", async () => {
    const ctx = ctxFor(userA);
    const lesson = makeLesson({ source_type: "youtube", video_provider: "youtube", video_ref: "abc123" });
    const res = await createLesson(ctx, lesson);
    expect(res.video_next_step).toContain("youtube");
    const st = await getIngestStatus(ctx, lesson.id);
    expect(st.status).toBe("ready");
  });

  it("local → status ready ngay, lưu video_size_bytes", async () => {
    const ctx = ctxFor(userA);
    const lesson = makeLesson({ video_provider: "local", video_ref: "meeting.mp4", video_size_bytes: 1234567 });
    const res = await createLesson(ctx, lesson);
    expect(res.video_next_step).toContain("local");
    expect((await getIngestStatus(ctx, lesson.id)).status).toBe("ready");
    const { data } = await admin.from("lessons").select("video_size_bytes").eq("id", lesson.id).single();
    expect(data!.video_size_bytes).toBe(1234567);
  });

  it("RLS: user B không đọc được bài private của user A qua core", async () => {
    const ctxA = ctxFor(userA);
    const ctxB = ctxFor(userB);
    const lesson = makeLesson({ title: "Của A" });
    await createLesson(ctxA, lesson);

    const listB = await listLessons(ctxB);
    expect(listB.find((l) => l.id === lesson.id)).toBeUndefined();
    await expect(getIngestStatus(ctxB, lesson.id)).rejects.toThrow();
  });
});
