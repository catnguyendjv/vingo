// Tiện ích test integration với Supabase local. Client user tạo bằng user-JWT mint HS256
// (giống production MCP) → mọi query đi qua RLS thật, không dùng service role cho dữ liệu.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { CoreContext } from "./context.js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:55321";
// Khoá local well-known của Supabase (không phải secret cần bảo vệ).
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";

export const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

export function mintUserJwt(userId: string): string {
  return jwt.sign({ sub: userId, role: "authenticated", aud: "authenticated" }, JWT_SECRET, {
    expiresIn: "10m",
  });
}

export function userClient(userId: string): SupabaseClient {
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${mintUserJwt(userId)}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function ctxFor(userId: string): CoreContext {
  return { userId, supabase: userClient(userId) };
}

export async function createTestUser(): Promise<string> {
  const email = `core-${randomUUID()}@vingo.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "devpass123",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createTestUser: ${error?.message}`);
  return data.user.id;
}

// Dọn sạch: xoá bài (service role bypass RLS) rồi xoá user.
export async function cleanupUser(userId: string): Promise<void> {
  await admin.from("lessons").delete().eq("owner_id", userId);
  await admin.auth.admin.deleteUser(userId);
}

interface LessonOverrides {
  title?: string;
  source_type?: "zoom" | "youtube" | "upload";
  video_provider?: "storage" | "youtube";
  video_ref?: string;
  cueText?: string;
  vocabTerm?: string;
}

// Dựng lesson JSON hợp lệ tối giản với id ngẫu nhiên.
export function makeLesson(o: LessonOverrides = {}) {
  const cueId = randomUUID();
  return {
    id: randomUUID(),
    title: o.title ?? "Bài test",
    source_type: o.source_type ?? "zoom",
    source_lang: "ja",
    target_lang: "vi",
    video_provider: o.video_provider,
    video_ref: o.video_ref,
    cues: [
      {
        id: cueId,
        idx: 1,
        start_ms: 0,
        end_ms: 4000,
        text_source: o.cueText ?? "テスト文です。",
        text_target: "Đây là câu test.",
      },
    ],
    vocab: [
      {
        id: randomUUID(),
        cue_id: cueId,
        term: o.vocabTerm ?? "テスト",
        reading: "てすと",
        meaning: "test",
      },
    ],
  };
}
