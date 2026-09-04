import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegStatic from "ffmpeg-static";
import { createLesson } from "@vingo/core";
import { afterAll, beforeAll, expect, it } from "vitest";
import { coreContext, serviceClient } from "../supabase.js";
import { getObjectInfo, videoPath } from "../storage.js";
import { enqueueIngest } from "./worker.js";

const FFMPEG = ffmpegStatic as unknown as string;
let userId: string;
let dir: string;

function ff(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { windowsHide: true });
    let e = "";
    p.stderr.on("data", (d) => (e += d));
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(e.slice(-300)))));
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  const email = `worker-${randomUUID()}@vingo.local`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: "devpass123",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  userId = data.user.id;
  dir = await mkdtemp(join(tmpdir(), "vingo-worker-"));
});

afterAll(async () => {
  await serviceClient().from("lessons").delete().eq("owner_id", userId);
  await serviceClient().auth.admin.deleteUser(userId);
  await rm(dir, { recursive: true, force: true });
});

it("đường B: file trong Storage → pipeline → lesson ready + thumb", async () => {
  const ctx = coreContext(userId);
  // Bài draft (upload, chưa có video).
  const cueId = randomUUID();
  const lessonId = randomUUID();
  await createLesson(ctx, {
    id: lessonId,
    title: "Worker test",
    source_type: "upload",
    source_lang: "ja",
    target_lang: "vi",
    cues: [{ id: cueId, idx: 1, start_ms: 0, end_ms: 3000, text_source: "テスト" }],
    vocab: [],
  });

  // Upload fixture h264 vào path chuẩn (service role).
  const src = join(dir, "src.mp4");
  await ff([
    "-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=10",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", src,
  ]);
  const body = await readFile(src);
  const up = await serviceClient()
    .storage.from("videos")
    .upload(videoPath(userId, lessonId), body, { contentType: "video/mp4", upsert: true });
  expect(up.error).toBeNull();

  // Enqueue job storage → poll tới ready.
  expect(enqueueIngest({ lessonId, userId, ownerId: userId, source: { kind: "storage" } })).toBe(true);

  type Row = { status: string; duration_sec: number | null; thumb_path: string | null; ingest_error: string | null };
  let status = "draft";
  let row: Row | null = null;
  for (let i = 0; i < 60 && status !== "ready" && status !== "error"; i++) {
    await sleep(500);
    const { data } = await serviceClient()
      .from("lessons")
      .select("status, duration_sec, thumb_path, ingest_error")
      .eq("id", lessonId)
      .single();
    row = data as Row | null;
    status = row?.status ?? status;
  }

  expect(row?.ingest_error ?? null).toBeNull();
  expect(status).toBe("ready");
  expect(row?.duration_sec ?? 0).toBeGreaterThan(0);
  expect(row?.thumb_path).toBe(`${userId}/${lessonId}/thumb.jpg`);

  const thumb = await getObjectInfo(`${userId}/${lessonId}/thumb.jpg`);
  expect(thumb?.size ?? 0).toBeGreaterThan(0);
}, 60000);
