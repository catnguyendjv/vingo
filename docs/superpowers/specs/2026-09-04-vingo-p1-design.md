# Vingo P1 — study-kit-mcp + skill (Design Spec)

- **Ngày**: 2026-09-04
- **Trạng thái**: Đã duyệt design qua thảo luận (A–F); chờ Cát review bản spec này
- **Spec nền**: `docs/superpowers/specs/2026-08-28-vingo-design.md` (spec master) — spec này chi tiết hoá
  phần P1 và ghi lại các quyết định mới; chỗ nào không nói khác thì spec master là chuẩn.

## 1. Mục tiêu & phạm vi

### 1.1 Mục tiêu
Tạo bài học mới end-to-end từ Claude Code trên máy Cát: skill `study-kit` + remote MCP
`study-kit-mcp` chạy **localhost**, dữ liệu vào **Supabase local**, video qua pipeline ffmpeg
server-side, bài `ready` xem được trên web local.

### 1.2 Quyết định mới của P1 (bổ sung/điều chỉnh so với spec master)
| # | Quyết định |
|---|---|
| P1-1 | **MCP chạy localhost**, chưa deploy. Hạ tầng chung tính ở phase deploy sau (Cát đã chốt dùng chung hạ tầng MCP sẵn có khi deploy). Dockerfile viết sẵn nhưng P1 không bắt buộc chạy container |
| P1-2 | **P1 gọn**: bỏ khỏi phạm vi — nâng Supabase Pro, cloud provisioning (Task 17 P0), upload 5 video cũ lên cloud, SETUP.md cho đồng nghiệp. Các mục này thuộc phase deploy |
| P1-3 | **OAuth 2.1 + pairing đầy đủ ngay** (không làm bearer token tạm): phần khó retrofit nhất, bảng đã có sẵn từ P0; lúc deploy chỉ đổi BASE_URL |
| P1-4 | **Skeleton OAuth tham chiếu = `dr-joy/drive-automation-mcp`** (`src/auth/provider.ts` + `store.ts`, Express + Streamable HTTP). Spec master ghi `redmine-automation-mcp` nhưng repo đó không tồn tại dưới tên này |
| P1-5 | ffmpeg/ffprobe qua npm **`ffmpeg-static` / `ffprobe-static`** — dev localhost không cần cài gì; Dockerfile sau này dùng ffmpeg apt (env `FFMPEG_PATH`/`FFPROBE_PATH` override được) |
| P1-6 | Mint user-JWT bằng **HS256 + `SUPABASE_JWT_SECRET`** (local lấy từ `supabase status`). Cloud sau này dùng legacy JWT secret của project — ghi runbook, không chặn P1 |
| P1-7 | Web sinh pairing code qua **RPC `create_pairing_code()` SECURITY DEFINER** (migration mới) — giữ ràng buộc P0 "service role key không bao giờ vào `apps/web`" |
| P1-8 | PWA manifest vẫn làm trong P1 (không phụ thuộc cloud) |

### 1.3 Điều kiện xong P1
Trên máy Cát: `/settings` sinh pairing code → `claude mcp add --transport http study-kit
http://localhost:<port>/mcp` + `claude mcp login study-kit` (dán code) → skill tạo 1 bài mới
end-to-end (transcript → lesson JSON → `create_lesson` → video đường A hoặc B → pipeline ffmpeg
→ `status='ready'`) → mở bài trên web local, video phát + seek bình thường.

### 1.4 Ngoài phạm vi P1
Deploy MCP lên hạ tầng chung · Supabase Pro/cloud · upload video cloud · SETUP.md onboarding
đồng nghiệp · SRS (P1.5) · YouTube player (P2) · service worker (P2) · track 2.

## 2. Kiến trúc P1

```
┌─ Máy Cát ────────────────────────────────────────────────────────────┐
│ Claude Code                                                          │
│  ├─ skill skills/study-kit ──MCP (Streamable HTTP)──┐               │
│  ├─ zoom-mcp / video-download-mcp / STT MCP          │               │
│  └─ đường B: curl PUT ── signed URL ──────────┐      ▼               │
│                                               │  apps/mcp (localhost:PORT)
│                                               │   ├─ mcpAuthRouter + login page (pairing)
│                                               │   ├─ tools → packages/core (user-JWT + RLS)
│                                               │   └─ ingest worker (ffmpeg-static, job nền)
│                                               ▼      │ service role: storage + hash + janitor
│  Supabase LOCAL (supabase start, port 553xx) ◀───────┘               │
│   Auth / Postgres+RLS / Storage                                      │
│         ▲ supabase-js + JWT user (RLS)                               │
│  apps/web (localhost:3000) — thêm /settings + PWA manifest           │
└──────────────────────────────────────────────────────────────────────┘
```

Nguyên tắc quyền (giữ nguyên spec master §2.1): core **không dùng service role cho dữ liệu** —
adapter mint user-JWT ngắn hạn → supabase client thường → RLS thật. Service role chỉ cho:
(a) validate pairing/token hash, (b) ký signed URL storage, (c) janitor/cleanup.

## 3. `packages/core` — service layer

```
packages/core/
├─ package.json               # @vingo/core; deps: @supabase/supabase-js, @vingo/shared
├─ src/context.ts             # export type CoreContext = { userId: string; supabase: SupabaseClient }
├─ src/lessons.ts             # listLessons, createLesson, getIngestStatus
├─ src/knownWords.ts          # getKnownWords(ctx, lang)
├─ src/authoring.ts           # getAuthoringGuide(): string — đọc content/authoring-guide.md
├─ content/authoring-guide.md # canonical authoring rules (mục 3.2)
└─ src/*.test.ts              # vitest integration với Supabase local
```

Ràng buộc: không import type nào của MCP SDK; mọi function nhận `CoreContext` làm tham số đầu.
Track 2 sau này import thẳng package này.

### 3.1 API
- `listLessons(ctx)` → bài của user (id, title, status, visibility, created_at) — RLS tự giới hạn.
- `createLesson(ctx, lessonJson)` — validate `lessonJsonSchema` (@vingo/shared) rồi ghi.
  **Idempotent theo spec master §4.2**: id chưa có → insert lessons + cues + vocab;
  id đã có và `status ∈ {draft, error}` → xoá cues/vocab cũ, thay toàn bộ (giữ nguyên owner);
  `status ∈ {ready, processing}` → không đè, trả `{already_exists: true, message}`.
  Trả `{lesson_id, web_url, video_next_step}` (`video_next_step` gợi ý đường A/B hoặc
  "youtube — không cần video").
  Ghi nhiều bảng không có transaction phía client → thứ tự insert lessons → cues → vocab;
  fail giữa chừng thì lesson còn `draft` và lần retry (cùng id, draft) thay toàn bộ — chấp nhận,
  không cần RPC transaction riêng.
- `getKnownWords(ctx, lang)` → `{term, reading, meaning}[]`.
- `getIngestStatus(ctx, lessonId)` → `{status, ingest_error}` (đọc bảng lessons qua RLS).
- `getAuthoringGuide()` → string markdown (pure, không cần ctx).

### 3.2 `content/authoring-guide.md` (canonical — tool `get_authoring_guide` trả nguyên văn)
Port từ `SKILL.md` của jp-study-kit (`C:\Users\cat.nguyen\Desktop\study-kit-test\jp-study-kit`),
tổ chức lại thành các mục:
1. Schema lesson JSON (đồng bộ với `lessonJsonSchema`) + ví dụ hoàn chỉnh.
2. Rule chuẩn hoá cues: dedup rolling caption (auto-sub YouTube), gộp/tách thành câu tự nhiên
   giữ timestamp, `start_ms < end_ms`, idx liên tục từ 1.
3. Rule biên tập transcript: sửa số/đơn vị/katakana nghe nhầm theo ngữ cảnh; chỗ không chắc
   đánh `uncertain: true` (web hiện ⚠); giữ giọng văn nói.
4. Rule chọn vocab: ưu tiên đời sống > cảm thán/aizuchi > IT > business; bỏ từ N5 + tên riêng;
   0–5 từ/câu, gắn ở câu xuất hiện đầu tiên; loại từ đã có trong `get_known_words`.
5. Ràng buộc cứng: transcript phải có timestamp — không có thì không tạo bài.
6. Privacy: ẩn/bỏ tên khách hàng, thông tin dự án nhạy cảm khi nguồn là họp nội bộ.

## 4. `apps/mcp` — study-kit-mcp

```
apps/mcp/
├─ package.json          # deps: express, @modelcontextprotocol/sdk, @supabase/supabase-js,
│                        #       @vingo/core, @vingo/shared, jsonwebtoken, ffmpeg-static, ffprobe-static, zod
├─ Dockerfile            # node:22-slim + ffmpeg (apt) — viết sẵn cho phase deploy, P1 không dùng
└─ src/
   ├─ index.ts           # Express app: mcpAuthRouter + requireBearerAuth + POST/GET/DELETE /mcp
   │                     # (StreamableHTTPServerTransport, 1 McpServer/session, session map in-memory), /healthz
   ├─ config.ts          # env: PORT (default 8787), BASE_URL (http://localhost:8787),
   │                     # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET,
   │                     # WEB_URL (http://localhost:3000), FFMPEG_PATH/FFPROBE_PATH (optional override),
   │                     # INGEST_MAX_BYTES (default 5GiB), INGEST_TIMEOUT_MS, JANITOR_STALE_MIN (30)
   ├─ auth/
   │  ├─ provider.ts     # custom OAuthServerProvider (skeleton drive-automation-mcp)
   │  ├─ store.ts        # oauth_clients + mcp_grants trên Supabase (service role);
   │  │                  # pending authorization codes in-memory (TTL ngắn — mất khi restart, chấp nhận)
   │  ├─ login-page.ts   # GET /authorize: form dán pairing code; POST: validate + consume + redirect
   │  └─ jwt.ts          # mintUserJwt(userId): HS256, sub/role=authenticated, TTL 10', cache theo session
   ├─ tools/             # 9 tools — adapter mỏng: userId từ authInfo.extra → CoreContext → core
   ├─ ingest/
   │  ├─ worker.ts       # queue in-process Map<lessonId, Job>; job nền download/copy → pipeline → upload
   │  ├─ pipeline.ts     # ffprobe → (transcode libx264+aac | remux -c copy) + -movflags +faststart
   │  │                  # → thumb.jpg (1 frame) → duration_sec → upload Storage → status ready/error
   │  ├─ ssrf.ts         # guard đường A (mục 4.3)
   │  └─ janitor.ts      # setInterval: lessons processing quá JANITOR_STALE_MIN → error;
   │                     # xoá pairing_codes hết hạn; dọn file tạm mồ côi
   └─ types.ts
```

### 4.1 Auth & pairing (OAuth 2.1)
- Mount `mcpAuthRouter` (metadata + `/authorize` + `/token` + `/register` DCR) với
  `issuerUrl = BASE_URL`; `requireBearerAuth` với `resourceMetadataUrl` cho route `/mcp`.
- **DCR mở** (không whitelist redirect URI — Claude Code dùng `http://localhost:<random>/callback`),
  public client + PKCE (S256), không client_secret. Registrations persist vào `oauth_clients`
  (payload jsonb) — restart không mất, không phải pair lại.
- **Login page** `/authorize`: form HTML tối giản (server-rendered) dán pairing code →
  service role đọc `pairing_codes` chưa consume/chưa hết hạn của mọi user, so
  `crypto.timingSafeEqual(sha256(code), code_hash)` → set `consumed_at`, phát authorization
  code (in-memory, TTL 5') gắn `user_id` → redirect kèm code+state.
- **Token**: opaque random 32 bytes; lưu **sha256 hash** vào `mcp_grants`
  (`access_token_hash`, `refresh_token_hash`, `access_expires_at`, `device_label` từ
  client_name của DCR). Access TTL 1h; refresh sliding 30 ngày (mỗi lần refresh phát cặp mới,
  cập nhật hash cũ — không giữ nhiều dòng cho 1 grant).
- **verifyAccessToken**: tra `mcp_grants` theo hash, cache in-memory ≤60s; `revoked_at` set từ
  web → hết hiệu lực trong ≤60s. Cập nhật `last_used_at` (throttle 1 lần/phút).
- Session MCP: map `sessionId → {McpServer, transport, userId}` in-memory; DELETE /mcp dọn session.

### 4.2 Tools v1 (9 — mọi handler <60s, việc dài đi job nền)
Giữ đúng bảng spec master §4.2. Điểm cụ thể hoá:

| Tool | Input (zod) | Ghi chú triển khai |
|---|---|---|
| `whoami` | — | đọc profiles qua RLS, trả display_name + user_id |
| `get_authoring_guide` | — | trả nguyên văn markdown từ core (không cần DB) |
| `list_lessons` | — | core.listLessons |
| `get_known_words` | `{lang}` | core.getKnownWords |
| `create_lesson` | `{lesson: LessonJson}` | core.createLesson; `web_url = WEB_URL + /lessons/{id}` |
| `ingest_video_from_url` | `{lesson_id, url}` | verify ownership (RLS read + owner check) → SSRF guard → set `processing` → enqueue job → trả ngay `{status:'processing'}` |
| `get_ingest_status` | `{lesson_id}` | core.getIngestStatus |
| `request_video_upload` | `{lesson_id, kind:'video'\|'thumb', size, content_type}` | verify ownership → service role `createSignedUploadUrl` path `{owner_id}/{lesson_id}/video.mp4\|thumb.jpg` (server tự dựng path, không nhận từ client), TTL 2h; gọi lại tự do |
| `finalize_lesson` | `{lesson_id}` | verify object tồn tại + size>0 + content_type video → enqueue cùng pipeline trên file Storage (tải về temp bằng service role) → idempotent (đang processing thì trả processing) |

Resources (pattern các *-automation-mcp): `authoring-guide` + `lesson-json-example`.

### 4.3 Ingest pipeline + SSRF guard
Pipeline (chung đường A/B, và track 2 sau):
1. Lấy file vào temp dir (`os.tmpdir()/vingo-ingest/{lessonId}/`): đường A tải bằng `undici`
   stream (User-Agent browser-like cho link Zoom); đường B download từ Storage bằng service role.
2. `ffprobe` đọc codec/duration. `h264+aac` → remux `-c copy`; khác → transcode
   `-c:v libx264 -preset veryfast -c:a aac`; luôn `-movflags +faststart`.
3. Cắt 1 frame (giây 1 hoặc 10% duration) → `thumb.jpg` (~640px).
4. Upload `video.mp4` + `thumb.jpg` vào path chuẩn (service role, upsert) → update lessons:
   `status='ready'`, `duration_sec`, `thumb_path`, `video_ref`.
5. Lỗi bất kỳ → `status='error'` + `ingest_error` (message ngắn, actionable) ; luôn xoá temp.

SSRF guard (đường A, bắt buộc — unit test đủ nhánh):
- Chỉ `http:`/`https:`. Resolve DNS trước khi connect; chặn IP private/loopback/link-local/
  metadata (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7, fe80::/10).
- Theo redirect tối đa 3 lần, mỗi hop re-check IP đích.
- `content-type` phải `video/*` hoặc `application/octet-stream`; cap size `INGEST_MAX_BYTES`
  (đếm byte stream thực, không tin Content-Length); timeout tổng `INGEST_TIMEOUT_MS`.
- Lưu ý localhost P1: Supabase local cũng là 127.0.0.1 — guard chỉ áp cho URL đường A do user
  đưa (bên ngoài), KHÔNG áp cho kết nối nội bộ tới `SUPABASE_URL`.

Job model: in-process, không queue riêng; mỗi lesson tối đa 1 job (enqueue trùng → trả job đang
chạy). Restart giữa chừng → janitor đưa `processing` quá hạn về `error` (retry = gọi lại tool).

## 5. Migration `0007_pairing.sql` + web `/settings`

### 5.1 RPC `create_pairing_code()`
- SECURITY DEFINER, `set search_path = public`; `returns text`.
- Sinh code 8 ký tự từ bảng chữ `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (bỏ I/L/O/0/1) bằng
  `gen_random_bytes`; lưu `encode(digest(code,'sha256'),'hex')` vào `pairing_codes`
  (`user_id = (select auth.uid())`, `expires_at = now() + interval '10 minutes'`).
- Trước khi insert: `delete` code chưa consume của cùng user (mỗi user tối đa 1 code sống).
- `grant execute to authenticated; revoke from public, anon` (pattern 0006_grants).
- pgTAP `004_pairing.sql`: hash đúng sha256, TTL 10', user chỉ 1 code sống, user khác không
  SELECT được code của mình, anon không execute được.

### 5.2 Trang `/settings` (apps/web, route `(app)/settings`)
- **Kết nối Claude Code**: nút "Tạo mã ghép nối" → gọi `supabase.rpc('create_pairing_code')`
  (client component) → hiện code to + countdown 10' + copy button + hướng dẫn 2 lệnh
  `claude mcp add` / `claude mcp login` (URL MCP từ `NEXT_PUBLIC_MCP_URL`).
- **Thiết bị đã kết nối**: list `mcp_grants` `revoked_at is null` (device_label, created_at,
  last_used_at) + nút "Thu hồi" → UPDATE `revoked_at = now()` (policy P0 `grants_revoke` đã cho).
- **Profile**: display_name (update qua RLS `profiles_update`) + nút đăng xuất (route sẵn có).
- UI dùng design tokens + components của đợt redesign (Button, Card, Badge, Input...).
- Link vào Settings từ app header (icon), cả mobile.

## 6. Skill `skills/study-kit`

```
skills/study-kit/
├─ SKILL.md              # orchestration — mô tả dưới
└─ scripts/tus-upload.mjs # optional, mạng yếu: tus-js-client chunk 6MB
```

`SKILL.md` — flow cố định (mỏng, không chứa rule biên tập — rule sống server-side):
1. `whoami` xác nhận kết nối (fail → hướng dẫn add/login MCP).
2. `get_authoring_guide` — LUÔN gọi trước khi dựng bài; làm theo guide, không tự chế rule.
3. Thu thập transcript theo 2 ưu tiên (spec master §5.2):
   có sẵn (zoom-mcp / video-download-mcp `download_transcript` / user đưa link–dán–file)
   → không có thì STT MCP user có trong phiên (Soniox/ElevenLabs...)
   → không có cả hai: **DỪNG**, báo cần transcript có timestamp hoặc STT MCP.
   Ràng buộc cứng: transcript phải có timestamp.
4. Dựng lesson JSON nháp local (uuid client-sinh) theo guide; `get_known_words(lang)` để loại
   từ đã thuộc khỏi vocab.
5. `create_lesson` → nhận `{lesson_id, web_url, video_next_step}`.
6. Video: youtube → xong (không video file). Đường A ưu tiên (`ingest_video_from_url` — link
   Zoom lấy qua `get_recording_video_url` layout gallery_view rồi gọi ingest NGAY vì token ~1h;
   link MinIO của video-download-mcp; direct link bất kỳ). Đường B (file local):
   `request_video_upload` → `curl -X PUT --upload-file` (Bash timeout 600000ms hoặc
   run_in_background; đứt mạng → xin URL mới) → `finalize_lesson`.
7. Poll `get_ingest_status` (10–20s/lần) tới `ready`/`error`; error → báo `ingest_error` +
   hướng retry (gọi lại ingest/finalize).
8. Trả `web_url` cho user.

Ghi rõ trong SKILL.md: DB là bản chuẩn — lesson JSON local là nháp một chiều, sửa nội dung sau
khi tạo thì sửa trên web (không có update_lesson); link dạng trang share (Drive/Dropbox) không
phải direct link — kiểm tra và yêu cầu direct link.

## 7. PWA manifest (apps/web)

`app/manifest.ts` (name/short_name Vingo, `display: 'standalone'`, theme_color/background_color
theo design tokens, lang `vi`) + icon 192/512 maskable + `apple-touch-icon` trong `app/`.
Không service worker (P2). Verify: Lighthouse installable / Add to Home Screen.

## 8. Testing

| Lớp | Cách test |
|---|---|
| `packages/core` | vitest integration với Supabase local: createLesson idempotency (mới/draft-thay/ready-từ chối), getKnownWords, RLS thật (user A không đọc bài private user B qua core) — client tạo bằng user-JWT mint như production |
| `apps/mcp` ssrf | unit thuần: private IP các dải, redirect sang IP cấm, content-type sai, cap size |
| `apps/mcp` pipeline | integration: fixture video nhỏ tự sinh bằng ffmpeg-static (h264 → remux; libx265 → transcode); assert faststart (moov trước mdat), thumb tồn tại, duration đúng |
| OAuth flow | script integration: DCR → GET/POST authorize với pairing code thật → đổi token → gọi `whoami` qua StreamableHTTP client SDK; case code sai/hết hạn/dùng lại; revoke → 401 trong ≤60s |
| SQL | pgTAP `004_pairing.sql` (mục 5.1) |
| Web | e2e Playwright bổ sung: `/settings` sinh code hiển thị + list thiết bị (seed grant giả) |
| Manual (điều kiện xong) | end-to-end từ Claude Code thật trên máy Cát (mục 1.3) |

## 9. Vận hành & runbook (P1)

- Chạy dev: `supabase start` → `pnpm --filter web dev` → `pnpm --filter mcp dev`
  (env từ `apps/mcp/.env` — có `.env.example`; `SUPABASE_JWT_SECRET` từ `supabase status`).
- Rotate JWT secret (cloud sau này) ⇒ cập nhật env MCP — ghi trong `.env.example`.
- Temp disk: `os.tmpdir()/vingo-ingest/` — janitor dọn; 1 video 5GB cần ~2× dung lượng tạm
  (input + output) trên ổ C, chấp nhận ở localhost.
- Phase deploy (ngoài P1, ghi để không quên): Dockerfile đã có; cần HTTPS domain trên hạ tầng
  MCP chung, đổi `BASE_URL`/`NEXT_PUBLIC_MCP_URL`, Supabase cloud (Task 17) + Pro trước khi
  upload video thật, SETUP.md.
