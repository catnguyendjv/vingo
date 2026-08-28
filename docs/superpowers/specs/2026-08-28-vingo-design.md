# Vingo — App học ngoại ngữ từ video (Design Spec)

- **Ngày**: 2026-08-28
- **Trạng thái**: Đã duyệt design qua thảo luận; chờ Cát review bản spec này
- **Nguồn gốc**: Nâng cấp ý tưởng `jp-study-kit` (kit local: Zoom recording → Claude biên tập
  transcript/dịch/rút từ vựng → web app học theo câu + SQLite tiến độ) thành sản phẩm
  web + mobile dùng chung cho cộng đồng nội bộ.

## 1. Mục tiêu & phạm vi

### 1.1 Mục tiêu
Biến video (Zoom recording, YouTube, video user upload) thành bài học ngoại ngữ tương tác:
video + phụ đề 2 ngôn ngữ sync theo câu + từ vựng chọn lọc + từ điển cá nhân + ôn tập SRS.
Phần "làm ngôn ngữ" (biên tập caption, dịch, chọn từ đáng học) do Claude của chính user
thực hiện qua skill + MCP do mình cung cấp.

### 1.2 Quyết định đã chốt (không mở lại trong phase này)
| # | Quyết định |
|---|---|
| 1 | Đối tượng: cộng đồng nhỏ/nội bộ trước (đồng nghiệp học tiếng Nhật), mở rộng sau |
| 2 | Nguồn video MVP: Zoom recording + YouTube + video user upload |
| 3 | Mobile = web responsive + PWA, 1 codebase Next.js. Native để sau |
| 4 | Track tạo bài: Hướng 1 (user tự dùng Claude Code + MCP/skill, free) trước. Hướng 2 (server chạy Claude tạo bài hộ, trả phí) là phase sau, phải cắm vào cùng hợp đồng ingest |
| 5 | Database: Supabase (Auth + Postgres + Storage + Edge Functions), region **Tokyo (ap-northeast-1)** |
| 6 | Schema đa ngôn ngữ generic (source_lang/target_lang); nội dung JP→VN làm trước |
| 7 | Bài học private mặc định + share vào thư viện cộng đồng; tiến độ/từ đã thuộc luôn per-user |
| 8 | Feature MVP: parity jp-study-kit + SRS/flashcard |
| 9 | Frontend: Next.js + React, deploy Vercel |
| 10 | MCP: remote server theo skeleton `dr-joy/redmine-automation-mcp` (Express + Streamable HTTP + OAuth 2.1 login page) |
| 11 | Auth app: **invite-only** — tắt public signup, mời qua Supabase Admin invite |
| 12 | Transcript khi nguồn không có sẵn: dùng **STT MCP user đã có** (Soniox, ElevenLabs Scribe…). Không có thì skill dừng, báo rõ lý do. **Không ship hướng dẫn Whisper local/API trong MVP** (tính sau) |
| 13 | Video vào hệ thống bằng **2 đường**: (A) chính — user đưa **direct-download link**, server tự tải; (B) phụ — file local trên máy user, upload qua signed URL. **ffmpeg chạy hoàn toàn server-side** (codec check, faststart, thumbnail) — creator không cần cài ffmpeg. Transcript user cung cấp nhận qua link direct / dán thẳng / file local, **bắt buộc có timestamp** |

### 1.3 Ngoài phạm vi MVP
- Track 2 (server-side lesson generation, trả phí) — chỉ chừa sẵn kiến trúc.
- Native app, offline video, service worker offline (P2+), FSRS optimizer, R2/CDN riêng.
- Whisper local/API cho video không transcript.
- Cơ chế report/takedown nội dung community (cần khi mở public).

## 2. Kiến trúc tổng thể

```
┌─ Máy user (creator) ─────────────────┐      ┌─ Cloud ──────────────────────────────┐
│ Claude Code                          │      │  study-kit-mcp (Express + ffmpeg,    │
│  ├─ skill `study-kit` (orchestration)│─MCP─▶│   Docker, 1 instance luôn-bật)       │
│  ├─ zoom-us-mcp / yt-dlp (caption)   │      │   ├─ packages/core (service layer)   │
│  ├─ STT MCP của user (Soniox/11Labs) │      │   │    │ user-JWT (RLS)              │
│  └─ transcript user đưa              │      │   └─ ingest worker (job nền):        │
│     (link direct / dán / file local) │      │      tải video (URL hoặc Storage) →  │
│        │                             │      │      ffprobe → transcode/faststart → │
│        │ đường B: file local         │      │      thumb → Storage                 │
│        └ curl PUT ── signed URL ────────────▶        ▼                             │
│  đường A: direct-download link ─MCP─▶│      │  Supabase (Tokyo)                    │
└──────────────────────────────────────┘      │  Auth / Postgres+RLS / Storage       │
                                              │        ▲                             │
┌─ Browser (consumer, zero setup) ─────┐      │        │ supabase-js + RLS           │
│ thư viện / trang học / từ điển / SRS │◀─────│  Web app Next.js PWA (Vercel)        │
└──────────────────────────────────────┘      └──────────────────────────────────────┘
```

4 thành phần:

1. **Supabase** — nguồn sự thật duy nhất. Auth (invite-only) + Postgres + Storage
   (bucket `videos` private hoàn toàn) + tối đa 1 Edge Function.
2. **Web app** (`apps/web`) — Next.js App Router + PWA trên Vercel. Supabase client thuần,
   mọi quyền qua RLS. Không có backend tự viết.
3. **study-kit-mcp** (`apps/mcp`) — remote MCP server theo skeleton redmine-automation-mcp:
   Express + `StreamableHTTPServerTransport` (1 McpServer/session) + OAuth 2.1 qua
   `mcpAuthRouter` + custom `OAuthServerProvider` (login page dán pairing code).
   Deploy Docker (**image có ffmpeg**, disk tạm ~1–2GB), **1 instance, tắt auto-stop**
   (session MCP in-memory). Kèm **ingest worker** chạy nền trong cùng process (Node async,
   chưa cần queue riêng): tải video → ffprobe → transcode/faststart → thumbnail → Storage.
4. **Skill `study-kit`** (`skills/study-kit`) — chỉ orchestration local (KHÔNG cần ffmpeg
   trên máy user). Toàn bộ rule biên tập + rule chọn vocab + schema lesson JSON là
   **canonical server-side** qua tool `get_authoring_guide` (skill luôn gọi trước khi dựng
   bài) → sửa rule không cần user cài lại skill; track 2 dùng chung nguồn sự thật.

**Service layer tách `packages/core`**: mọi business function nhận context thuần
`{ userId, supabase }` — không import type của MCP SDK. `apps/mcp` chỉ là adapter
(extract userId từ `authInfo.extra` rồi gọi core). Track 2 worker sau này import thẳng
`packages/core` với userId từ job record. `packages/shared` chứa zod schema lesson JSON
+ types sinh từ `supabase gen types` — dùng chung web/mcp/skill docs.

### 2.1 Mô hình quyền truy cập dữ liệu (quan trọng)
- **Web app**: supabase-js + JWT user → RLS.
- **MCP/core**: KHÔNG dùng service role cho thao tác dữ liệu. Core **mint JWT user ngắn hạn**
  (sub = userId, role = authenticated, TTL 5–15 phút, cache theo session; ký bằng JWT signing
  key của project) → tạo supabase client thường → mọi query đi qua RLS thật. Quên scope
  cũng không lộ dữ liệu người khác.
- Service role chỉ dùng cho đúng 3 việc: (a) validate pairing code / grant, (b) ký URL
  Storage (signed upload/playback URL), (c) job admin (migrate, cleanup).
- Vận hành: rotate JWT signing key ⇒ phải cập nhật key cho MCP (ghi runbook).

## 3. Schema Postgres

Quy ước: mọi bảng có `created_at timestamptz default now()`; bảng mutable thêm `updated_at`.
`lang` dùng mã BCP-47 ngắn (`ja`, `vi`, `en`).

```
profiles        id uuid PK (= auth.users.id), display_name text, native_lang text default 'vi'

lessons         id uuid PK (client-generated),
                owner_id uuid → profiles NOT NULL,
                title text NOT NULL, lesson_date date,
                source_type text CHECK IN ('zoom','youtube','upload'),
                source_ref text,                       -- zoom uuid / youtube url / tên file
                source_lang text NOT NULL default 'ja',
                target_lang text NOT NULL default 'vi',
                video_provider text CHECK IN ('storage','youtube'),
                video_ref text,                        -- storage path | youtube video id
                duration_sec int, thumb_path text,     -- thumb null với youtube (derive i.ytimg.com)
                status text CHECK IN ('draft','processing','ready','error') default 'draft',
                -- draft: metadata đã tạo, chưa có video sẵn sàng
                -- processing: ingest worker đang tải/transcode; error: job fail (xem ingest_error)
                ingest_error text NULL,
                visibility text CHECK IN ('private','community') default 'private',
                deleted_at timestamptz NULL            -- soft delete

cues            id uuid PK (client-generated, ỔN ĐỊNH vĩnh viễn),
                lesson_id uuid → lessons NOT NULL,
                idx int NOT NULL, start_ms int NOT NULL, end_ms int NOT NULL,
                text_source text NOT NULL, text_target text,
                uncertain bool default false, note text,
                UNIQUE(lesson_id, idx), UNIQUE(id, lesson_id)   -- phục vụ composite FK

vocab_items     id uuid PK, lesson_id uuid NOT NULL, cue_id uuid NOT NULL,
                term text NOT NULL, reading text, meaning text NOT NULL, sort int,
                FK (cue_id, lesson_id) REFERENCES cues(id, lesson_id) ON DELETE CASCADE
                -- composite FK: chặn vocab bài A trỏ cue bài B

known_words     user_id uuid →, lang text NOT NULL, term text NOT NULL,
                reading text, meaning text, first_lesson_id uuid NULL,
                marked_at timestamptz, PK (user_id, lang, term)

cue_progress    user_id uuid →, cue_id uuid → cues ON DELETE CASCADE,
                lesson_id uuid NOT NULL,               -- denormalize: query từ điển/% bài rẻ
                done_at timestamptz, PK (user_id, cue_id)

review_cards    id uuid PK, user_id uuid →, lang text NOT NULL, term text NOT NULL,
                reading text, meaning text, source_lesson_id uuid NULL,
                -- state FSRS (khớp ts-fsrs 5.x Card):
                due_at timestamptz NOT NULL, stability real, difficulty real,
                scheduled_days int, learning_steps int,
                reps int default 0, lapses int default 0,
                state text NOT NULL default 'New',     -- 'New'|'Learning'|'Review'|'Relearning' (đúng string của lib)
                last_review_at timestamptz NULL, suspended bool default false,
                UNIQUE(user_id, lang, term)

review_logs     id uuid PK, card_id uuid → review_cards, user_id uuid NOT NULL,
                rating smallint NOT NULL, reviewed_at timestamptz NOT NULL,
                log jsonb NOT NULL                     -- nguyên ReviewLog của ts-fsrs → Undo + optimizer sau này

pairing_codes   id uuid PK, user_id uuid →, code_hash text NOT NULL,
                expires_at timestamptz NOT NULL,       -- TTL 5–10 phút
                consumed_at timestamptz NULL           -- one-time

mcp_grants      id uuid PK, user_id uuid →, client_id text NOT NULL, device_label text,
                access_token_hash text, refresh_token_hash text,
                access_expires_at timestamptz, last_used_at timestamptz,
                revoked_at timestamptz NULL

oauth_clients   client_id text PK, payload jsonb NOT NULL   -- DCR registrations (persist!)
```

Ghi chú thiết kế:
- **`lang` trong PK của known_words/review_cards**: bắt buộc để đa ngôn ngữ không đè nhau
  ("chat" EN vs FR). Homograph cùng ngôn ngữ chấp nhận gộp theo term (product decision MVP).
- **cue id do client sinh + ổn định**: sửa bài không mất tiến độ người học. MCP v1 không có
  update_lesson (mục 5) nên writer duy nhất là create_lesson; web sửa inline từng cue theo id.
- **reading**: nullable, generic đủ dùng (yomi/pinyin/romanization; để trống với EN).
- ts-fsrs pin major **5.x** (v6 bỏ elapsed_days — schema này đã tương thích trước).

### 3.1 RLS

Nguyên tắc: viết policy tách SELECT/INSERT/UPDATE/DELETE tường minh, có WITH CHECK đầy đủ;
mọi policy dùng `(select auth.uid())`; logic "ai đọc được lesson" gom vào 1 function:

```sql
create function can_read_lesson(l_id uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from lessons l
    where l.id = l_id and l.deleted_at is null
      and (l.owner_id = (select auth.uid())
           or (l.visibility = 'community' and l.status = 'ready'))
  );
$$;
```

- `lessons`: owner ALL (WITH CHECK `owner_id = auth.uid()`, UPDATE không cho đổi owner);
  SELECT thêm cho authenticated khi `visibility='community' AND status='ready' AND deleted_at IS NULL`.
  Owner vẫn thấy bài đã soft-delete (để restore) — web UI tự filter.
- `cues`, `vocab_items`: SELECT qua `can_read_lesson(lesson_id)`; INSERT/UPDATE/DELETE
  WITH CHECK lesson thuộc sở hữu mình.
- `known_words`, `cue_progress`, `review_cards`, `review_logs`: `user_id = (select auth.uid())`
  cho mọi action (review_logs có user_id denormalize chính vì policy này).
- `pairing_codes`, `mcp_grants`: user SELECT/UPDATE(revoke) của mình; validate hash do
  service role làm. `oauth_clients`: chỉ service role.
- **Từ điển**: RPC `my_dictionary()` (SECURITY INVOKER — mặc định) GROUP BY `(source_lang, term)`,
  gộp: bài mình sở hữu + bài community đã học (EXISTS cue_progress theo lesson_id denormalize).
  **CẤM view thường** (CREATE VIEW mặc định bypass RLS — lint 0010); nếu cần view thì bắt buộc
  `WITH (security_invoker = true)`. Bật Supabase database advisors trong checklist release.
- Index bắt buộc migration đầu: `cues(lesson_id)`, `vocab_items(lesson_id)`, `vocab_items(cue_id)`,
  `lessons(owner_id)`, partial `lessons(visibility, status) WHERE deleted_at IS NULL`,
  `cue_progress(user_id, lesson_id)`, `review_cards(user_id, due_at)`.

### 3.2 Storage
- Bucket `videos`, **private**. Path do server tự dựng: `{owner_id}/{lesson_id}/video.mp4`
  và `{owner_id}/{lesson_id}/thumb.jpg` — không bao giờ nhận path từ client.
- Playback: **PoC ở P0** — policy SELECT trên `storage.objects` (EXISTS join lessons theo
  path convention + `can_read_lesson`) rồi web gọi `createSignedUrl` trực tiếp bằng JWT user.
  Nếu PoC fail → fallback Edge Function `get-video-url`: client #1 (JWT user, RLS) SELECT
  lesson để check quyền; client #2 (service role) chỉ `createSignedUrl`. Quyền định nghĩa
  đúng 1 chỗ = RLS, không duplicate.
- Signed URL TTL ~2h; **cache và trả cùng một signed URL cho cùng lesson trong cửa sổ TTL**
  (tăng Smart CDN hit — cache key theo token; Smart CDN chỉ có từ Pro).
- HTTP Range hỗ trợ sẵn trên signed URL (seek video OK — đã kiểm chứng storage-api).

## 4. MCP server (`study-kit-mcp`)

### 4.1 Auth & pairing
- Skeleton OAuth như redmine-automation-mcp; khác biệt: login page nhận **pairing code
  one-time** thay vì credential bền.
- Flow: web app (Settings → Kết nối Claude) sinh code 6–8 ký tự, lưu hash vào `pairing_codes`
  (TTL 5–10 phút). User chạy `claude mcp add --transport http study-kit <url>` +
  `claude mcp login study-kit` → browser mở login page → dán code → MCP validate (service
  role, so hash `crypto.timingSafeEqual`), consume code, mint access/refresh token
  (opaque, hash lưu `mcp_grants`).
- **verifyAccessToken tra DB mỗi request** (hoặc cache ≤60s) → revoke từ web (set
  `revoked_at`) có hiệu lực tức thì. TTL: access ~1h, refresh sliding 30–90 ngày.
- **Persist vào Supabase cả 3 thứ**: DCR client registrations (`oauth_clients`), pending
  authorization codes (TTL ngắn — chấp nhận mất khi restart giữa flow), grants/tokens.
  Không persist client registrations = mỗi lần redeploy toàn bộ user phải pair lại.
- DCR mở (không whitelist redirect URI — Claude Code dùng `http://localhost:<port ngẫu nhiên>/callback`),
  public client + PKCE, không client_secret. Mount đủ protected-resource metadata
  (`requireBearerAuth` với `resourceMetadataUrl`).
- Trang Settings web: list `mcp_grants` (device_label + last_used_at) làm UI "thiết bị đã
  kết nối", nút revoke từng grant.

### 4.2 Tools v1 (9 tools — mọi handler < 60s; việc dài chạy job nền + poll)
| Tool | Mô tả |
|---|---|
| `whoami()` | Xác nhận kết nối, trả display_name + user id |
| `get_authoring_guide()` | Canonical: rule biên tập transcript + rule chọn vocab + schema lesson JSON + rule chuẩn hoá cues (dedup rolling caption, tách câu giữ timestamp) + ràng buộc transcript có timestamp |
| `list_lessons()` | Bài của user (chống tạo trùng, tra cứu) |
| `get_known_words(lang)` | Từ đã thuộc theo ngôn ngữ — skill loại khỏi vocab bài mới |
| `create_lesson(lesson_json)` | Validate zod (packages/shared), insert transaction lessons+cues+vocab. **Idempotent**: lesson id do client sinh; retry với id đã tồn tại: nếu `status='draft'`/`'error'` → thay toàn bộ; nếu `'ready'` → trả "đã tồn tại, sửa trên web" (không đè). Trả `{lesson_id, web_url, video_next_step}` |
| `ingest_video_from_url(lesson_id, url)` | **Đường A (chính)**: verify ownership + SSRF guard → set `status='processing'`, trả ngay; job nền tải file (giới hạn size + timeout, hỗ trợ URL Zoom kèm User-Agent) → pipeline ffmpeg → Storage → `status='ready'` hoặc `'error'` + `ingest_error` |
| `get_ingest_status(lesson_id)` | Poll trạng thái job: `processing` / `ready` / `error` (+ ingest_error) |
| `request_video_upload(lesson_id, kind: video\|thumb, size, content_type)` | **Đường B (phụ, file local không có link)**: verify ownership → signed upload URL (TTL 2h), path server tự dựng. Gọi lại tự do khi token hết hạn |
| `finalize_lesson(lesson_id)` | Đường B: verify file tồn tại + size khớp + content_type → kích hoạt **cùng pipeline ffmpeg** trên file trong Storage (job nền, `status='processing'` → `'ready'`/`'error'`). Idempotent |

Pipeline ffmpeg server-side (chung cho cả 2 đường + track 2 sau này): ffprobe check codec
→ không phải h264/aac thì transcode `-c:v libx264 -c:a aac`; h264 sẵn thì remux
`-c copy`; luôn `-movflags +faststart`; cắt 1 frame làm thumb.jpg; đo duration_sec;
upload kết quả vào path chuẩn rồi xoá file tạm.

**SSRF guard** cho `ingest_video_from_url` (bắt buộc): chỉ nhận http(s); resolve DNS rồi
chặn IP private/loopback/link-local/metadata (169.254.x.x); chặn redirect sang IP cấm;
giới hạn dung lượng tải (theo bucket limit) + timeout tổng; content-type phải là video.

Cắt khỏi v1 (thêm sau khi có nhu cầu thật, không tốn migration): `update_lesson`,
`delete_lesson`, `add/remove_known_word` — web đã làm được các việc này; cắt update_lesson
đồng thời loại bài toán 2-writer conflict (DB là bản chuẩn, lesson JSON local chỉ là nháp
một chiều — ghi rõ trong skill).

References resources (pattern redmine MCP): authoring guide + ví dụ lesson JSON.

### 4.3 Đưa video vào hệ thống (2 đường)
- **Đường A — direct-download link (chính)**: user/skill đưa URL mà HTTP GET trả thẳng
  file (link Zoom cloud download — token sống ~1h, server tải kèm User-Agent; link
  Supabase Storage; link file server bất kỳ). Server tải + xử lý, máy user không đụng
  tới file video. Link dạng trang web (Google Drive/Dropbox share page) KHÔNG dùng được —
  skill kiểm tra và báo user lấy direct link.
- **Đường B — file local trên máy user (phụ)**: `curl -X PUT --upload-file` lên signed
  upload URL — chịu tới 5GB; Windows có sẵn curl.exe. Skill bắt buộc chạy Bash timeout
  600000ms hoặc `run_in_background`. Đứt mạng → xin URL mới, upload lại. Optional cho
  mạng yếu: script Node ~20 dòng dùng `tus-js-client` với header `x-signature` (chunk 6MB
  bắt buộc, endpoint `{project}.storage.supabase.co`) — kèm sẵn trong skill repo.
  **Không hứa "TUS bằng curl"** (không khả thi).
- Cả 2 đường hội tụ về cùng pipeline ffmpeg server-side (mục 4.2) trước khi bài `ready`.

## 5. Skill `study-kit`

### 5.1 Vai trò
Orchestration local, mỏng. Luôn: `whoami` → `get_authoring_guide` → thu thập nguyên liệu
→ dựng lesson JSON local → `get_known_words(lang)` để loại từ đã thuộc → `create_lesson`
→ (nếu cần) upload video/thumb → `finalize_lesson` → trả link web cho user.
Giữ nguyên "phần giá trị nhất" của SKILL.md cũ (rule biên tập caption: sửa số/đơn vị/
katakana nghe nhầm, đánh dấu `uncertain` ⚠; rule ưu tiên vocab: đời sống > cảm thán/aizuchi
> IT > business, bỏ N5 + tên riêng, 0–5 từ/câu gắn ở câu xuất hiện đầu) — nhưng các rule này
sống trong `get_authoring_guide`, skill chỉ trỏ tới.

### 5.2 Lấy transcript (pluggable, 2 ưu tiên — KHÔNG có fallback thứ 3)
1. **Transcript có sẵn** (từ nguồn hoặc do user cung cấp):
   - Zoom: zoom-us-mcp (`resolve_recording_link`, `get_recording_transcript`) — như
     SKILL.md hiện tại; yêu cầu `has_transcript: true`.
   - YouTube: yt-dlp trên máy user — `yt-dlp -U` trước; `--write-auto-subs --sub-format json3
     --skip-download` (sub thường: `--write-subs`); dedup rolling caption + gộp/tách lại thành
     câu tự nhiên bằng word-level timing của json3 (rule nằm trong authoring guide).
     Server/track-2 KHÔNG bao giờ tự fetch caption (ToS + chặn IP datacenter); track 2 nguồn
     YouTube bắt buộc client gửi kèm transcript.
   - **User cung cấp trực tiếp**: link direct-download (Claude tự tải về đọc), dán thẳng
     vào chat, hoặc file local — nhận mọi format phổ biến (VTT/SRT/JSON/text có mốc giờ).
     **Ràng buộc cứng: transcript phải có timestamp** — không có thì không sync câu với
     video được (giá trị cốt lõi của app); skill báo và dừng, không tạo bài "chay".
2. **STT MCP user đã có** (không rơi vào nhánh nào ở trên, hoặc YouTube caption fail
   429/sub rỗng): skill phát hiện MCP STT khả dụng trong phiên (Soniox, ElevenLabs
   Scribe, …) và dùng nó. Hợp đồng đầu vào duy nhất: transcript dạng segment có timestamp
   → Claude chuẩn hoá về cues `start_ms/end_ms`.
3. **Không có cả 2** → skill DỪNG, báo rõ: nguồn này cần transcript có timestamp hoặc STT
   MCP (gợi ý Soniox/ElevenLabs). Không hướng dẫn cài Whisper (quyết định #12).

### 5.3 Video & thumbnail (máy user KHÔNG cần ffmpeg — mọi xử lý ở server)
- Zoom: lấy download URL layout `gallery_view` (tránh bản `(CC)`) qua
  `get_recording_video_url` → đưa thẳng cho `ingest_video_from_url` (đường A, token URL
  sống ~1h nên gọi ingest ngay sau khi lấy URL). Không tải video về máy user nữa.
- YouTube: không tải video, không thumb (web derive `i.ytimg.com/vi/{id}/hqdefault.jpg`).
- Video user: có direct link → đường A; file local → đường B (curl PUT signed URL).
- Codec check (HEVC → h264/aac), remux `+faststart`, thumbnail, duration: tất cả do
  **pipeline ffmpeg server-side** làm (mục 4.2) — áp dụng đồng nhất cho mọi nguồn và
  cho track 2 sau này. Skill chỉ cần poll `get_ingest_status` tới khi `ready`/`error`
  và báo kết quả (kèm ingest_error nếu fail).
- Privacy khi biên tập transcript họp nội bộ: ẩn/bỏ tên khách hàng, thông tin dự án nhạy cảm
  (rule trong authoring guide).

## 6. Web app

### 6.1 Trang
- `/` thư viện: tab **Của tôi** / **Cộng đồng**; card thumbnail + progress; bài
  `draft`/`processing`/`error` hiện badge tương ứng (+ ingest_error và hướng dẫn
  retry/xoá với bài `error`) — lesson kẹt ingest không vô hình.
- `/lessons/[id]` trang học: video + transcript theo câu (click-to-seek, auto-highlight,
  auto-scroll), panel từ vựng theo câu, A–B repeat, tốc độ 0.5–1.5x, ẩn/hiện bản dịch,
  đánh dấu từ đã thuộc / câu đã học, "▶ Tiếp tục câu chưa học", sửa inline (owner) theo
  cue id, nút share community (kèm dialog xác nhận riêng cho nguồn zoom: "người trong video
  đã đồng ý chưa?"), nút "Đưa cả bài vào ôn tập".
- `/dictionary` từ điển: RPC `my_dictionary()`, tìm/lọc theo bài + đã thuộc/chưa, gộp trùng
  `(lang, term)` + đếm số bài, sửa tại chỗ (bài mình sở hữu), deep-link tới câu, CSV export.
- `/review` SRS. `/settings`: profile + pairing + thiết bị đã kết nối.
- Auth: invite-only — không có trang signup; login bằng email đã được mời (password hoặc
  magic link). KHÔNG bật Google OAuth ở MVP (OAuth provider tự tạo account mới → lách mất
  invite-only; bật lại khi chuyển sang mô hình duyệt member).

### 6.2 Player abstraction
Interface: `load, play, pause, seekTo, getCurrentTime, getRate, setRate, onTime, state`.
- `HTML5Player` (storage): `<video>` + signed URL, sự kiện `timeupdate`.
- `YouTubePlayer`: IFrame API, `playerVars {playsinline:1}`, **không auto-play** (mobile chặn
  scripted play trước gesture đầu — có state `needsUserGesture`, xử lý `onAutoplayBlocked`);
  auto-resume chỉ seekTo sau khi user bấm play; polling `getCurrentTime` 250ms + nội suy
  `lastKnownTime + elapsed×rate` cho highlight mượt; A–B repeat đặt setTimeout dự đoán điểm B.
  **Không overlay UI đè lên player** (developer policies) — phụ đề/controls đặt cạnh player
  (bản HTML5 tự host thì tự do). Xử lý `onError` 100/101/150 (video xoá/chặn embed) → thông báo.

### 6.3 SRS
- Engine: `ts-fsrs` pin 5.x. Round-trip đủ field (mục 3), state string đúng chuẩn lib.
- Enroll **explicit only**: nút per-từ + nút "Đưa cả bài vào ôn tập" (trừ từ trong
  known_words). KHÔNG auto-enroll ẩn. Cap **20 thẻ new/ngày** hard-code (queue = due trước,
  new đổ vào phần còn lại).
- Đồng bộ known_words ↔ cards: đánh dấu đã thuộc → suspend card; bỏ đánh dấu → unsuspend;
  "đưa vào ôn tập" từ đang known → unmark known + unsuspend/create; enroll trùng term →
  giữ card cũ (first-wins).
- Review UI: flashcard term → flip (reading + meaning), 4 nút Again/Hard/Good/Easy;
  Undo lần review cuối (`fsrs.rollback` từ `review_logs.log`).

### 6.4 PWA
- P1: `app/manifest.ts` + icon 192/512 maskable + theme_color + apple-touch-icon +
  `display: standalone` (~1 giờ, đủ installable iOS/Android — Chrome đã bỏ yêu cầu SW).
- P2: service worker (serwist) — precache app shell + trang offline fallback, network-first
  cho data. **Offline video: không làm** (signed URL TTL + YouTube không cho phép).

## 7. Vận hành, chi phí, an toàn dữ liệu

- **Chi phí**: P0 dev trên Free (schema + metadata). **Lên Pro ($25/th) là bước bắt buộc
  trong checklist trước khi upload video thật** (Free: 50MB/file hard cap, 1GB storage,
  5GB egress; Pro: 100GB storage + 250GB egress — 10 user xem thoải mái ~12% quota) +
  chỉnh Global file size limit & bucket limit sau khi nâng. Ngưỡng tính R2: egress vượt
  250GB/tháng đều đặn (schema có `video_provider` — thêm 'r2' sau không đập gì).
  Free project pause sau 1 tuần không hoạt động — thêm lý do lên Pro sớm.
- **Backup**: Pro backup daily chỉ Postgres, **không cover Storage**. Từ P0: GitHub Actions
  cron hằng đêm `supabase db dump` → repo private/R2. Video gốc: người tạo giữ file local
  tối thiểu tới khi có backup thứ hai. Script migrate KHÔNG xoá `study.db` + video local.
- **Privacy/compliance**: region Tokyo; bài zoom mặc định private + dialog xác nhận share;
  rule ẩn thông tin nhạy cảm trong authoring guide; chạy 利用申請 nội bộ (skill
  secure-scaffold) trước khi mời đồng nghiệp dùng.
- **Onboarding 2 vai trò**: consumer = browser, zero setup; creator = Claude Code +
  SETUP.md 1 trang (2 lệnh `claude mcp add/login`, cách cài skill; yt-dlp chỉ cần khi
  làm bài từ YouTube — KHÔNG cần ffmpeg). Tuần đầu creator ≈ một mình Cát — chấp nhận
  có ý thức; số creator thực tế là dữ liệu định giá track 2.
- **MCP hosting**: 1 container luôn-bật (min_machines_running=1 / tắt auto-stop), không
  scale ngang (session + ingest job in-memory). Image có ffmpeg, disk tạm ~1–2GB cho
  ingest; job dở dang khi restart → bài ở `processing` quá X phút coi như `error`
  (janitor định kỳ). Cron dọn `oauth_clients` mồ côi + `pairing_codes` hết hạn + file tạm.

## 8. Monorepo & phases

```
vingo/
├─ apps/web            Next.js PWA
├─ apps/mcp            study-kit-mcp (Express + MCP SDK, Dockerfile)
├─ packages/core       service layer ({userId, supabase} → business functions)
├─ packages/shared     zod lesson JSON schema + DB types
├─ skills/study-kit    SKILL.md + scripts (tus uploader) + SETUP.md
├─ supabase/           migrations SQL + seed + config
└─ scripts/            migrate-from-jp-study-kit.mjs
```

| Phase | Nội dung | Điều kiện xong |
|---|---|---|
| **P0** | Supabase project (Tokyo, invite-only) + toàn bộ migrations + RLS + web đọc/học (thư viện, trang học HTML5, từ điển, tiến độ) + PoC storage policy playback + migrate 5 bài jp-study-kit (metadata + known_words + cue_progress từ study.db; video upload khi lên Pro) + backup cron | Cát học được 5 bài cũ trên web/mobile |
| **P1** | study-kit-mcp (auth pairing + 9 tools + ingest worker ffmpeg) + skill (Zoom → YouTube → video user) + lên Pro + upload 5 video cũ + manifest PWA + SETUP.md | Tạo bài mới end-to-end từ Claude Code |
| **P1.5** | SRS (/review + enroll + đồng bộ known_words) | Ôn tập chạy với FSRS |
| **P2** | YouTube player + share community + service worker + polish mobile | Mời đồng nghiệp (sau 利用申請) |
| **P3** | Track 2: worker Claude CLI + billing — dùng lại packages/core + authoring guide | (spec riêng khi đến lúc) |

## 9. Testing
- `packages/shared`: unit test zod schema (lesson JSON hợp lệ/không hợp lệ, cue overlap, id trùng).
- `packages/core`: unit test SRS transition (ts-fsrs round-trip DB), known_words↔cards rules,
  idempotency create_lesson.
- RLS: test SQL (pgTAP hoặc supabase test) cho từng policy — đặc biệt: user lạ không đọc
  được bài private, không đọc được vocab qua RPC từ điển, không ghi được lesson gán owner khác.
- MCP: integration test flow pairing + create_lesson bằng MCP inspector/client script;
  test SSRF guard của ingest_video_from_url (URL private IP/metadata/redirect bị chặn);
  test pipeline ingest với file HEVC (ra h264) + file h264 (chỉ remux) + URL chết (ra
  `error` kèm ingest_error).
- E2E smoke (Playwright): login → mở bài → seek theo câu → đánh dấu từ → từ điển thấy từ.
- Checklist release: Supabase database advisors (security + performance) sạch.

## 10. Rủi ro & điểm mở
- Transcode server-side trên container nhỏ chậm với video dài codec sai (HEVC 500MB có
  thể mất nhiều phút CPU) — chấp nhận: job nền không chặn ai, skill poll và báo tiến độ;
  đa số nguồn (Zoom) là h264 nên chỉ remux vài giây. Nếu thành nút cổ chai thật thì mới
  cân nhắc nâng CPU/queue riêng.
- yt-dlp có thể hỏng bất kỳ lúc nào (429/PO token/sub rỗng) → đã có đường STT MCP; nếu cả
  hai kẹt, user chọn nguồn khác. Chấp nhận.
- Skill phát hiện "STT MCP khả dụng" là heuristic (tên tool thay đổi theo server) — viết
  dạng hướng dẫn nhận diện + hỏi user, không hard-code danh sách.
- Whisper (local/API) deliberately deferred — quyết định #12; khi cần sẽ thêm như một
  lựa chọn ưu tiên 2.5 không đổi kiến trúc.
- Track 2 chi tiết (queue, billing, giới hạn YouTube phía server) để spec riêng ở P3.
