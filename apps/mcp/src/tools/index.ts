import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { lessonJsonSchema } from "@vingo/shared";
import {
  createLesson,
  getAuthoringGuide,
  getIngestStatus,
  getKnownWords,
  listLessons,
} from "@vingo/core";
import { config } from "../config.js";
import { coreContext } from "../supabase.js";
import { createSignedUpload, getObjectInfo, thumbPath, videoPath } from "../storage.js";
import { assertHostAllowed } from "../ingest/ssrf.js";
import { enqueueIngest, isRunning } from "../ingest/worker.js";

const text = (v: unknown) => ({
  content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }],
});
const errText = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], isError: true });

// Ví dụ lesson JSON cho resource lesson-json-example.
const LESSON_EXAMPLE = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Ví dụ bài học",
  source_type: "zoom",
  source_lang: "ja",
  target_lang: "vi",
  video_provider: "storage",
  cues: [
    {
      id: "00000000-0000-4000-8000-0000000000c1",
      idx: 1,
      start_ms: 0,
      end_ms: 4200,
      text_source: "とりあえずリリースは来週で大丈夫ですか？",
      text_target: "Trước mắt release vào tuần sau có ổn không ạ?",
    },
  ],
  vocab: [
    {
      id: "00000000-0000-4000-8000-0000000000a1",
      cue_id: "00000000-0000-4000-8000-0000000000c1",
      term: "とりあえず",
      reading: "とりあえず",
      meaning: "trước mắt / tạm thời",
    },
  ],
};

export function registerTools(server: McpServer, userId: string): void {
  const ctx = coreContext(userId);

  // Xác nhận lesson thuộc sở hữu user (RLS đọc + so owner). Trả owner_id + status.
  async function verifyOwned(lessonId: string): Promise<{ ownerId: string; status: string }> {
    const { data, error } = await ctx.supabase
      .from("lessons")
      .select("owner_id, status")
      .eq("id", lessonId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.owner_id !== userId) throw new Error("Không tìm thấy bài hoặc bài không thuộc về bạn.");
    return { ownerId: data.owner_id, status: data.status };
  }

  server.registerTool("whoami", { description: "Xác nhận kết nối; trả display_name + user_id." }, async () => {
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();
    if (error) return errText(error.message);
    return text({ user_id: userId, display_name: data.display_name });
  });

  server.registerTool(
    "get_authoring_guide",
    { description: "Rule biên tập + chọn vocab + schema lesson JSON (canonical). GỌI trước khi dựng bài." },
    async () => text(getAuthoringGuide()),
  );

  server.registerTool("list_lessons", { description: "Danh sách bài của bạn (chống tạo trùng, tra cứu)." }, async () => {
    try {
      return text(await listLessons(ctx));
    } catch (e) {
      return errText(e instanceof Error ? e.message : String(e));
    }
  });

  server.registerTool(
    "get_known_words",
    {
      description: "Từ đã thuộc theo ngôn ngữ — loại khỏi vocab bài mới.",
      inputSchema: { lang: z.string().min(2).describe("Mã ngôn ngữ nguồn, vd 'ja'") },
    },
    async ({ lang }) => {
      try {
        return text(await getKnownWords(ctx, lang));
      } catch (e) {
        return errText(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "create_lesson",
    {
      description: "Validate + ghi bài (idempotent theo id). Trả lesson_id, web_url, gợi ý bước video.",
      inputSchema: { lesson: lessonJsonSchema },
    },
    async ({ lesson }) => {
      try {
        const res = await createLesson(ctx, lesson);
        return text({ ...res, web_url: `${config.webUrl}/lessons/${res.lesson_id}` });
      } catch (e) {
        return errText(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "ingest_video_from_url",
    {
      description: "Đường A: server tải direct-download link → pipeline ffmpeg. Trả ngay processing.",
      inputSchema: {
        lesson_id: z.string().uuid(),
        url: z.string().url().describe("Direct-download link (Zoom/MinIO/direct). KHÔNG phải trang share."),
      },
    },
    async ({ lesson_id, url }) => {
      try {
        const { ownerId } = await verifyOwned(lesson_id);
        // Fail-fast SSRF: protocol + host (guard đầy đủ chạy lại lúc tải trong job).
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") return errText("Chỉ hỗ trợ http/https.");
        await assertHostAllowed(u.hostname);

        await ctx.supabase.from("lessons").update({ status: "processing", ingest_error: null }).eq("id", lesson_id);
        enqueueIngest({ lessonId: lesson_id, userId, ownerId, source: { kind: "url", url } });
        return text({ status: "processing", message: "Đang tải & xử lý video. Poll get_ingest_status." });
      } catch (e) {
        return errText(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "get_ingest_status",
    { description: "Trạng thái ingest: processing / ready / error (+ ingest_error).", inputSchema: { lesson_id: z.string().uuid() } },
    async ({ lesson_id }) => {
      try {
        return text(await getIngestStatus(ctx, lesson_id));
      } catch (e) {
        return errText(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "request_video_upload",
    {
      description: "Đường B: signed upload URL (PUT). Path server tự dựng. Gọi lại tự do khi hết hạn.",
      inputSchema: {
        lesson_id: z.string().uuid(),
        kind: z.enum(["video", "thumb"]),
        size: z.number().int().positive().optional(),
        content_type: z.string().optional(),
      },
    },
    async ({ lesson_id, kind }) => {
      try {
        const { ownerId } = await verifyOwned(lesson_id);
        const path = kind === "thumb" ? thumbPath(ownerId, lesson_id) : videoPath(ownerId, lesson_id);
        const { signedUrl, token } = await createSignedUpload(path);
        return text({
          path,
          token,
          signed_url: signedUrl,
          method: "PUT",
          hint: "curl -X PUT --upload-file <file> '<signed_url>' ; sau đó gọi finalize_lesson.",
        });
      } catch (e) {
        return errText(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "finalize_lesson",
    { description: "Đường B: kiểm tra file đã upload rồi chạy pipeline. Idempotent.", inputSchema: { lesson_id: z.string().uuid() } },
    async ({ lesson_id }) => {
      try {
        const { ownerId } = await verifyOwned(lesson_id);
        if (isRunning(lesson_id)) return text({ status: "processing", message: "Đang xử lý." });

        const info = await getObjectInfo(videoPath(ownerId, lesson_id));
        if (!info || info.size <= 0) return errText("Chưa thấy file video đã upload. Hãy request_video_upload + PUT trước.");
        const ct = (info.contentType ?? "").toLowerCase();
        if (!(ct.startsWith("video/") || ct === "application/octet-stream")) {
          return errText(`content-type không phải video: ${info.contentType ?? "(trống)"}`);
        }

        await ctx.supabase.from("lessons").update({ status: "processing", ingest_error: null }).eq("id", lesson_id);
        enqueueIngest({ lessonId: lesson_id, userId, ownerId, source: { kind: "storage" } });
        return text({ status: "processing", message: "Đang xử lý video từ Storage. Poll get_ingest_status." });
      } catch (e) {
        return errText(e instanceof Error ? e.message : String(e));
      }
    },
  );

  // Resources (pattern *-automation-mcp).
  server.registerResource(
    "authoring-guide",
    "vingo://authoring-guide",
    { title: "Authoring guide", description: "Rule tạo bài canonical", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: getAuthoringGuide() }] }),
  );
  server.registerResource(
    "lesson-json-example",
    "vingo://lesson-json-example",
    { title: "Lesson JSON ví dụ", description: "Ví dụ lesson JSON hợp lệ", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(LESSON_EXAMPLE, null, 2) }],
    }),
  );
}
