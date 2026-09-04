import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runPipeline } from "./pipeline.js";

const FFMPEG = ffmpegStatic as unknown as string;

function ff(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(err.slice(-400)))));
  });
}

async function faststart(path: string): Promise<boolean> {
  const buf = await readFile(path);
  const moov = buf.indexOf(Buffer.from("moov"));
  const mdat = buf.indexOf(Buffer.from("mdat"));
  return moov !== -1 && mdat !== -1 && moov < mdat;
}

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "vingo-pipe-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runPipeline", () => {
  it("h264 → remux -c copy, thêm faststart, có thumb + duration", async () => {
    const src = join(dir, "h264.mp4");
    await ff([
      "-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=10",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", src,
    ]);
    const work = await mkdtemp(join(dir, "w-"));
    const res = await runPipeline(src, work);
    expect(res.remuxed).toBe(true);
    expect(res.durationSec).toBeGreaterThanOrEqual(1);
    expect(res.durationSec).toBeLessThanOrEqual(3);
    expect(await faststart(res.videoPath)).toBe(true);
    expect((await stat(res.thumbPath)).size).toBeGreaterThan(0);
  });

  it("mpeg4 (codec khác) → transcode sang libx264", async () => {
    const src = join(dir, "mpeg4.mp4");
    await ff([
      "-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=10",
      "-c:v", "mpeg4", src,
    ]);
    const work = await mkdtemp(join(dir, "w-"));
    const res = await runPipeline(src, work);
    expect(res.remuxed).toBe(false);
    expect(await faststart(res.videoPath)).toBe(true);
    expect((await stat(res.thumbPath)).size).toBeGreaterThan(0);
  });
});
