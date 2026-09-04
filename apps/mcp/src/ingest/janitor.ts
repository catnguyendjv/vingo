import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../config.js";
import { serviceClient } from "../supabase.js";
import { isRunning } from "./worker.js";

const INTERVAL_MS = 5 * 60 * 1000;

// Bài processing quá JANITOR_STALE_MIN mà không còn job in-process (restart giữa chừng) → error.
async function reapStaleLessons(): Promise<void> {
  const cutoff = new Date(Date.now() - config.janitorStaleMin * 60 * 1000).toISOString();
  const { data, error } = await serviceClient()
    .from("lessons")
    .select("id")
    .eq("status", "processing")
    .lt("updated_at", cutoff);
  if (error || !data) return;
  for (const l of data) {
    if (isRunning(l.id)) continue; // job còn chạy → để yên
    await serviceClient()
      .from("lessons")
      .update({ status: "error", ingest_error: "Ingest quá hạn (server restart?). Chạy lại." })
      .eq("id", l.id)
      .eq("status", "processing");
    await rm(join(tmpdir(), "vingo-ingest", l.id), { recursive: true, force: true }).catch(() => {});
  }
}

// Xoá pairing_codes đã hết hạn.
async function reapPairingCodes(): Promise<void> {
  await serviceClient().from("pairing_codes").delete().lt("expires_at", new Date().toISOString());
}

export function startJanitor(): NodeJS.Timeout {
  const tick = () => {
    void reapStaleLessons();
    void reapPairingCodes();
  };
  const t = setInterval(tick, INTERVAL_MS);
  t.unref?.();
  return t;
}
