import { spawn } from "node:child_process";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { config } from "../config.js";

const FFMPEG = config.ffmpegPath ?? (ffmpegStatic as unknown as string);
const FFPROBE = config.ffprobePath ?? ffprobeStatic.path;

function run(bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve({ stdout, stderr })
        : reject(new Error(`${bin} exit ${code}: ${stderr.slice(-500)}`)),
    );
  });
}

export interface ProbeResult {
  vcodec: string | null;
  acodec: string | null;
  durationSec: number;
}

export async function probe(inputPath: string): Promise<ProbeResult> {
  const { stdout } = await run(FFPROBE, [
    "-v", "quiet",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    inputPath,
  ]);
  const j = JSON.parse(stdout) as {
    streams?: { codec_type?: string; codec_name?: string }[];
    format?: { duration?: string };
  };
  const streams = j.streams ?? [];
  const vcodec = streams.find((s) => s.codec_type === "video")?.codec_name ?? null;
  const acodec = streams.find((s) => s.codec_type === "audio")?.codec_name ?? null;
  const durationSec = Math.round(Number(j.format?.duration ?? 0));
  return { vcodec, acodec, durationSec };
}

// h264 + (aac | không audio) → remux -c copy; còn lại transcode libx264/aac. Luôn +faststart.
export async function transcodeToMp4(
  inputPath: string,
  outPath: string,
  copy: boolean,
): Promise<void> {
  const codecArgs = copy
    ? ["-c", "copy"]
    : ["-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac"];
  await run(FFMPEG, [
    "-y",
    "-i", inputPath,
    ...codecArgs,
    "-movflags", "+faststart",
    outPath,
  ]);
}

export async function makeThumb(
  inputPath: string,
  outPath: string,
  durationSec: number,
): Promise<void> {
  const at = durationSec > 10 ? Math.floor(durationSec * 0.1) : 1;
  await run(FFMPEG, [
    "-y",
    "-ss", String(at),
    "-i", inputPath,
    "-frames:v", "1",
    "-vf", "scale=640:-2",
    outPath,
  ]);
}

export interface PipelineResult {
  videoPath: string;
  thumbPath: string;
  durationSec: number;
  remuxed: boolean;
}

// Chạy full pipeline trên file input tại chỗ; xuất video.mp4 + thumb.jpg vào workDir.
export async function runPipeline(inputPath: string, workDir: string): Promise<PipelineResult> {
  const info = await probe(inputPath);
  const canCopy = info.vcodec === "h264" && (info.acodec === "aac" || info.acodec === null);
  const videoPath = join(workDir, "video.mp4");
  const thumbPath = join(workDir, "thumb.jpg");
  await transcodeToMp4(inputPath, videoPath, canCopy);
  await makeThumb(videoPath, thumbPath, info.durationSec);
  return { videoPath, thumbPath, durationSec: info.durationSec, remuxed: canCopy };
}
