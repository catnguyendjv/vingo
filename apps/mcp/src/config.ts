// Env config. Mặc định = Supabase local well-known (dev không cần .env); production override qua env.
function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : d;
}

const PORT = num(process.env.PORT, 8787);

export const config = {
  port: PORT,
  baseUrl: process.env.BASE_URL ?? `http://localhost:${PORT}`,
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",

  supabaseUrl: process.env.SUPABASE_URL ?? "http://127.0.0.1:55321",
  anonKey:
    process.env.SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  serviceRoleKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  jwtSecret:
    process.env.SUPABASE_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long",

  ffmpegPath: process.env.FFMPEG_PATH,
  ffprobePath: process.env.FFPROBE_PATH,

  ingestMaxBytes: num(process.env.INGEST_MAX_BYTES, 5 * 1024 ** 3), // 5 GiB
  ingestTimeoutMs: num(process.env.INGEST_TIMEOUT_MS, 30 * 60 * 1000), // 30'
  janitorStaleMin: num(process.env.JANITOR_STALE_MIN, 30),

  storageBucket: "videos",
} as const;
