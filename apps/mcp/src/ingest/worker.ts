import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { serviceClient } from "../supabase.js";
import { downloadTo, thumbPath, uploadFrom, videoPath } from "../storage.js";
import type { IngestSource, Job } from "../types.js";
import { runPipeline } from "./pipeline.js";
import { guardedDownload } from "./ssrf.js";

// Queue in-process: mỗi lesson tối đa 1 job. Enqueue trùng → không làm gì (job đang chạy).
const running = new Map<string, Job>();

export function isRunning(lessonId: string): boolean {
  return running.has(lessonId);
}

export function enqueueIngest(input: {
  lessonId: string;
  userId: string;
  ownerId: string;
  source: IngestSource;
}): boolean {
  if (running.has(input.lessonId)) return false;
  const job: Job = { ...input, startedAt: Date.now() };
  running.set(job.lessonId, job);
  // Chạy nền, không await (handler tool trả ngay).
  void runJob(job);
  return true;
}

function shortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.slice(0, 300);
}

async function runJob(job: Job): Promise<void> {
  const base = join(tmpdir(), "vingo-ingest", job.lessonId);
  const workDir = join(base, "out");
  const inputPath = join(base, "input");
  try {
    await mkdir(workDir, { recursive: true });

    // 1. Lấy file vào temp.
    if (job.source.kind === "url") {
      const sink = createWriteStream(inputPath);
      await guardedDownload(job.source.url, sink, {
        maxBytes: config.ingestMaxBytes,
        timeoutMs: config.ingestTimeoutMs,
      });
    } else {
      // Đường B: file đã ở Storage theo path chuẩn (service role tải về temp).
      await downloadTo(videoPath(job.ownerId, job.lessonId), inputPath);
    }

    // 2–4. Pipeline ffmpeg → outputs.
    const res = await runPipeline(inputPath, workDir);

    // 5. Upload kết quả (upsert đè cả file raw đường B) → cập nhật lessons ready.
    await uploadFrom(videoPath(job.ownerId, job.lessonId), res.videoPath, "video/mp4");
    await uploadFrom(thumbPath(job.ownerId, job.lessonId), res.thumbPath, "image/jpeg");

    const { error } = await serviceClient()
      .from("lessons")
      .update({
        status: "ready",
        duration_sec: res.durationSec,
        thumb_path: thumbPath(job.ownerId, job.lessonId),
        video_provider: "storage",
        video_ref: videoPath(job.ownerId, job.lessonId),
        ingest_error: null,
      })
      .eq("id", job.lessonId);
    if (error) throw new Error(`update ready: ${error.message}`);
  } catch (e) {
    await serviceClient()
      .from("lessons")
      .update({ status: "error", ingest_error: shortError(e) })
      .eq("id", job.lessonId);
  } finally {
    running.delete(job.lessonId);
    await rm(base, { recursive: true, force: true }).catch(() => {});
  }
}
