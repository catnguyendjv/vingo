# Vingo P2 — Video local, YouTube, share community, PWA offline, polish mobile (Design Spec)

Ngày: 2026-09-08. **Trạng thái: đã triển khai** (commit `1640230`…`14de2df`, plan `docs/superpowers/plans/2026-09-08-vingo-p2.md`); còn kiểm tay trên điện thoại thật (§1.3). Bổ sung cho spec master `2026-08-28-vingo-design.md` §6.1 (trang học, share),
§6.2 (player abstraction), §6.4 (PWA) và §8 (phase P2). Khi lệch nhau, spec này thắng cho phạm vi P2.

## 1. Mục tiêu & phạm vi

### 1.1 Mục tiêu
Người học dùng được Vingo với mọi nguồn video mà không bắt buộc lưu video lên cloud: bài **video
local** (transcript + từ vựng trong DB, file video người học tự chọn trên máy), bài **YouTube**
phát sync trong trang học, bài **chia sẻ community** cho đồng nghiệp, app **PWA có trang offline**
và **trang học dùng tốt trên điện thoại** (cả xoay ngang). Toàn bộ chạy trên Supabase local +
dev server; **không đụng deploy** (đã quyết định lùi).

### 1.2 Quyết định đã chốt (2026-09-08)
| # | Quyết định |
|---|---|
| P2-1 | Thêm `video_provider = 'local'`: video **không lên cloud**, người học chọn file trên máy để phát. Đây là nền cho mô hình sau này "gói trả phí mới được lưu cloud" — P2 **không** làm tier/billing/gate, chỉ chuẩn bị provider |
| P2-2 | Video local trên mobile: **chọn lại file mỗi lần** mở bài (`<input type=file>`). Chromium desktop nhớ `FileSystemFileHandle` trong IndexedDB. Không copy vào OPFS/IndexedDB |
| P2-3 | Bài video local **được share community**; người xem tự chọn file của mình, transcript/từ vựng/từ điển vẫn đầy đủ. Card có badge "Video local" |
| P2-4 | Skill `study-kit`: khi có file video, **hỏi user "local hay cloud", mặc định local**. YouTube vẫn tự động `youtube`. Đường A/B hiện có giữ nguyên cho cloud |
| P2-5 | YouTube: `YouTubePlayerAdapter` **tự viết trên IFrame API**, không thêm thư viện; không autoplay; poll 250ms + nội suy |
| P2-6 | Service worker **viết tay** `public/sw.js`, không dùng serwist (`@serwist/next` không hỗ trợ Turbopack mà dự án dùng cho cả dev và build). Không offline video |
| P2-7 | Share: dialog xác nhận riêng cho nguồn `zoom` (checkbox bắt buộc), chỉ share bài `ready`. Không có report/takedown (ngoài phạm vi MVP) |
| P2-8 | Polish mobile theo danh sách audit §6 (landscape 2 cột, video gọn khi cuộn, Wake Lock, nút câu trước/sau, safe-area, 2 lỗi layout nhỏ) |

### 1.3 Điều kiện xong
Trên local: tạo bài video local từ skill (không upload) → mở trên điện thoại, chọn file, phát và
seek theo câu → bài YouTube phát sync, A–B, tốc độ → owner share/ngừng share, user khác thấy ở
tab Cộng đồng và học được → xoay ngang trang học dùng được, cuộn xuống video thu gọn → build
production đăng ký SW, ngắt mạng thấy trang `/offline` → `pnpm -r test`, `supabase test db`,
`pnpm e2e` xanh.

### 1.4 Ngoài phạm vi
Tier/billing/gate cloud · chuyển bài local → cloud sau khi tạo · OPFS/offline video · deploy,
Supabase Pro, MCP hosting · report/takedown community · vuốt đổi câu, đổi cỡ chữ, haptic ·
background sync · track 2.

## 2. Video local

### 2.1 Migration `0009_local_video.sql`
```
alter table lessons drop constraint lessons_video_provider_check;
alter table lessons add constraint lessons_video_provider_check
  check (video_provider in ('storage','youtube','local'));
alter table lessons add column video_size_bytes bigint;
```
- Không đổi RLS, storage policy, RPC. `can_read_lesson` không phụ thuộc provider.
- pgTAP `supabase/tests/007_local_video.sql`: owner insert bài `local` thành công; `video_size_bytes`
  nullable; provider lạ bị từ chối.

### 2.2 Hợp đồng ingest — `packages/shared`
- `lessonJsonSchema.video_provider`: `z.enum(["storage","youtube","local"])`.
- Thêm `video_size_bytes: z.number().int().positive().optional()`.
- Với `local`: `video_ref` = **tên file gốc** (chỉ để gợi ý người học, không phải khoá);
  `duration_sec` nên có (web dùng kiểm tra khớp), không có thì web bỏ kiểm tra.
- Test: JSON `local` hợp lệ; `local` không có `video_ref` vẫn hợp lệ (web hiện "chọn video").

### 2.3 `packages/core`
- `lessonRow`: `status = 'ready'` khi provider ∈ {`youtube`, `local`}; ghi `video_size_bytes`.
- `videoNextStep`: `local` → "local — không upload; người học tự chọn file trên web".
- Test: `local → ready`, `video_next_step` chứa "local".

### 2.4 `apps/mcp`
- Không thêm tool. `ingest_video_from_url`, `request_video_upload`, `finalize_lesson` gọi trên bài
  `video_provider = 'local'` → `errText("Bài này là video local, không nhận video. Muốn lưu cloud:
  tạo lại bài với video_provider 'storage'.")` — kiểm tra trong `verifyOwned` hoặc ngay sau.
- `get_authoring_guide`: thêm mục "video local" (tên file, duration, size).

### 2.5 Skill `study-kit` (SKILL.md bước 6)
Trước khi đi đường A/B, hỏi đúng 1 câu:
> Video này để **local** (mặc định — không upload, khi học sẽ chọn file trên máy) hay **lưu cloud**?

- Local: điền vào `create_lesson` luôn `video_provider: "local"`, `video_ref: <tên file>`,
  `duration_sec` (Zoom: từ metadata recording; video-download-mcp: từ `get_video_info`; file
  local: hỏi user hoặc bỏ trống), `video_size_bytes` nếu biết. Không gọi tool video nào nữa;
  báo `web_url` + nhắc "mở bài, bấm Chọn video và trỏ tới file `<tên>`".
- Cloud: giữ đúng flow đường A/B hiện tại.
- YouTube: không hỏi, `youtube` như cũ.

### 2.6 Web
- `lib/video.ts`: `getVideoUrl` trả `null` cho `local`; `getThumbUrl` trả `null` cho `local`.
- `lib/local-video.ts` (thuần, có unit test):
  - `supportsFileHandles()` = `'showOpenFilePicker' in window`.
  - `checkMatch(file, lesson) → { ok, reasons[] }`: `|duration − duration_sec| > 2s` hoặc
    `size ≠ video_size_bytes` (chỉ khi lesson có giá trị) → cảnh báo, không chặn.
  - IndexedDB `vingo-local-video` / store `handles`, key = `lesson.id`, value = `FileSystemFileHandle`;
    `saveHandle`, `loadHandle`, `forgetHandle`.
- `components/study/LocalVideoSource.tsx` (client), hiển thị trong khung video khi provider `local`
  và chưa có file:
  - Nút chính "Chọn video trên máy"; dòng phụ: tên file gợi ý (`video_ref`) + thời lượng.
  - Có handle đã lưu → nút "Mở lại `<tên>`" (gọi `handle.requestPermission({mode:'read'})` trong
    cử chỉ người dùng; bị từ chối/không còn file → xoá handle, quay về nút chọn).
  - Chọn xong → `onFile(file)`; StudyView tạo `URL.createObjectURL(file)`, gán `<video src>`,
    `revokeObjectURL` khi đổi file hoặc unmount. `Html5PlayerAdapter` không đổi.
  - Sau `loadedmetadata`: `checkMatch` → banner vàng "File có thể không đúng (thời lượng lệch …)"
    kèm nút "Chọn file khác". Vẫn cho phát.
  - Không có `showOpenFilePicker` (mobile/Safari/Firefox): `<input type="file" accept="video/*">`.
- Thư viện: `LessonCard` badge "Video local" (kind `neutral`) ở cả 2 tab; thumbnail = icon `video`
  trên nền `surface-2`; vẫn hiện thời lượng.
- Bài community local: người xem thấy đúng `LocalVideoSource` như owner (handle lưu theo user
  trên máy họ).

## 3. Player abstraction & YouTube

### 3.1 `PlayerAdapter` (lib/player.ts)
Thêm `onStateChange(cb: (s: 'playing' | 'paused' | 'ended') => void): () => void`.
`Html5PlayerAdapter` map từ sự kiện `play`/`pause`/`ended` của `<video>`.

### 3.2 `YouTubePlayerAdapter`
- `loadYouTubeApi()` module-level promise: chèn `https://www.youtube.com/iframe_api` một lần, resolve
  ở `onYouTubeIframeAPIReady`.
- `new YouTubePlayerAdapter(container: HTMLElement, videoId, { onError })` tạo `YT.Player` với
  `playerVars: { playsinline: 1, rel: 0, modestbranding: 1, autoplay: 0 }`.
- `onTime`: `setInterval` 250ms khi state `PLAYING`; giữa 2 lần poll nội suy
  `last + (now − lastAt) × rate` qua `requestAnimationFrame` để highlight/A–B mượt; dừng khi
  paused/ended.
- `seekTo(ms)` → `player.seekTo(ms/1000, true)`; `setRate` → `setPlaybackRate` (0.5/0.75/1/1.25/1.5
  đều hợp lệ với YouTube); `play/pause` → `playVideo/pauseVideo`; `destroy` → clear interval,
  `player.destroy()`.
- `onError` mã 100/101/150 → callback; StudyView hiện trong khung video "Video đã bị xoá hoặc
  không cho nhúng" + link mở trên YouTube. Mã khác → "Không phát được video".
- Không autoplay, không seek trước cử chỉ đầu: hash `#cue=` chỉ seek sau khi state lần đầu
  `PLAYING` (hoặc `CUED` + user bấm). A–B repeat dùng chính vòng poll (sai số ≤250ms chấp nhận).
- Không đè UI lên iframe (chính sách YouTube); phụ đề nằm dưới như hiện tại.

### 3.3 `components/study/VideoFrame.tsx`
Tách khối video khỏi StudyView. Props: `lesson`, `videoUrl`, `mode: 'full' | 'compact'`,
`onReady(player: PlayerAdapter)`, `onLocalFile(file)`. Render theo `video_provider`:
- `storage` (có `videoUrl`) hoặc `local` (đã chọn file) → `<video controls playsInline>` +
  `Html5PlayerAdapter`.
- `youtube` → `<div>` container + `YouTubePlayerAdapter`.
- `local` chưa có file → `LocalVideoSource`.
- còn lại → khối "Video chưa sẵn sàng" + badge trạng thái (như hiện nay).
StudyView chỉ giữ `playerRef`; cue-sync, A–B, tốc độ, hash-seek không đổi logic.

## 4. Share community

### 4.1 Quyền
Không cần migration: owner UPDATE `lessons` (0003), authenticated SELECT bài `community` + `ready`,
`profiles_select` cho mọi authenticated. pgTAP bổ sung nếu chưa có: user B đọc được cues/vocab
bài community `ready`; không đọc bài community `draft`; không UPDATE `visibility` bài của A.

### 4.2 UI
- `components/ui/Dialog.tsx`: bọc native `<dialog>` (`showModal`, Esc, click backdrop đóng), token
  màu theo theme, `role="dialog"` + `aria-labelledby`. Dùng chung.
- Trang học (owner): nút "Chia sẻ" (icon `share`) cạnh nút Sửa bài, cả desktop và mobile. Trạng
  thái: private → icon rỗng; community → icon đầy + `aria-pressed`.
  - Bấm khi private → Dialog xác nhận. Nguồn `zoom`: tiêu đề "Chia sẻ bản ghi họp?", nội dung
    "Người trong video đã đồng ý chưa? Tên khách hàng, dự án nhạy cảm đã ẩn chưa?", checkbox
    "Tôi đã xác nhận" bắt buộc để bật nút. Nguồn khác: xác nhận thường. Bài `local`: thêm dòng
    "Người xem sẽ phải tự có file video".
  - Bấm khi community → đổi về private ngay, toast "Đã ngừng chia sẻ" (không dialog).
  - Bài chưa `ready`: nút disabled, title "Chỉ chia sẻ được bài đã sẵn sàng".
- Mutation client: `update lessons set visibility` theo `id`; optimistic + rollback + toast lỗi.
- Người xem không phải owner: không thấy Sửa/Chia sẻ (`canEdit` hiện có); tiến độ, từ đã thuộc,
  enroll SRS vẫn per-user như hiện tại.
- Thư viện: tab Của tôi → badge "Cộng đồng" trên card đã share; tab Cộng đồng → dòng
  "bởi `<display_name>`" (1 query `profiles in (owner_id…)`), bài của chính mình có badge "Của bạn".

## 5. Service worker & offline

### 5.1 `apps/web/public/sw.js` (JS thuần, không build step)
- Hằng `VERSION` đổi tay mỗi lần sửa SW; cache name `vingo-${VERSION}`.
- `install`: precache `/offline`, `/manifest.webmanifest`, `/icon-192.png`, `/icon-512.png`; `skipWaiting`.
- `activate`: xoá cache khác `VERSION`; `clients.claim()`.
- `fetch` chỉ xử lý GET:
  - `request.mode === 'navigate'` (cùng origin): network-first, timeout 4s → cache của URL đó →
    `/offline`.
  - `/_next/static/**`, `/icon-*.png`, `fonts.gstatic.com`: cache-first (tên có hash / bất biến).
  - Bỏ qua hoàn toàn: Supabase (`NEXT_PUBLIC_SUPABASE_URL`, nhận qua query string khi đăng ký
    `sw.js?supabase=<origin>`), `/auth/*`, `i.ytimg.com`, `youtube.com`, mọi request có
    `Range` (video), cross-origin còn lại.
- Không background sync, không push.

### 5.2 Trang `/offline`
`app/offline/page.tsx` tĩnh, không gọi Supabase: icon + "Không có kết nối" + nút "Thử lại"
(`location.reload()`). Dùng token/theme như các trang khác.

### 5.3 Đăng ký & cập nhật
- `components/layout/ServiceWorkerRegistrar.tsx` (client) trong `app/layout.tsx`: chỉ khi
  `process.env.NODE_ENV === 'production'` và có `navigator.serviceWorker`. Dev không đăng ký.
- `registration.update()` khi `visibilitychange` → visible. Khi có worker mới `installed` và đã có
  controller → toast "Có bản mới — Tải lại" (không tự reload giữa lúc học).

## 6. Polish mobile (kết quả audit 2026-09-08, iPhone 13 emulate)

| # | Vấn đề | Cách làm |
|---|---|---|
| M1 | Landscape (844×390): video sticky + header chiếm hết màn, không thấy câu, dock đè video | Media query `(orientation: landscape) and (max-height: 500px)` (custom variant Tailwind `land:`): trang học 2 cột 55/45 (video trái, câu/từ phải cuộn riêng), header app ẩn, dock đáy ẩn và `StudyControls` hiện dạng dải mỏng dưới video. Cùng cây DOM, chỉ đổi class |
| M2 | Portrait: khối sticky ~45% màn, còn ~400px cho câu | `VideoFrame` mode `compact`: cuộn xuống quá 120px → video co còn 96px cao neo phải hàng tiêu đề, vẫn phát và sync (YouTube co bằng CSS, không destroy). Chạm video hoặc cuộn về đầu → `full`. Hàng tab vẫn sticky |
| M3 | Settings: ô lệnh tràn ngang | `overflow-x-auto whitespace-pre`, nút copy neo phải |
| M4 | Từ điển: nút CSV rơi dòng riêng | Gộp vào hàng bộ lọc, canh phải; <360px chỉ icon |
| M5 | Màn hình tắt khi nghe video dài | `useWakeLock(player)`: `navigator.wakeLock.request('screen')` khi `playing`, release khi `paused/ended`/tab ẩn, xin lại khi visible và đang phát. Không hỗ trợ → bỏ qua |
| M6 | Không có câu trước/sau; mở bài luôn về 0:00 | Hàng tab: 2 nút ‹ › giữa tab và vòng % (`activeIdx ± 1`; chưa có active → câu chưa học đầu). Mở bài không có hash → `seekTo` (không play) câu chưa học đầu tiên; với YouTube giữ làm "pending seek" và áp sau state `PLAYING` đầu tiên, giống hash-seek §3.2 |
| M7 | Standalone safe-area | `viewport-fit=cover` trong `viewport`; header đệm `env(safe-area-inset-top)`, dock đã có bottom. Manifest thêm `id: "/"`, `orientation: "any"` |

## 7. Kiểm thử
- Vitest: `local-video` (checkMatch, feature-detect, IndexedDB mock), `YouTubePlayerAdapter`
  (mock `YT.Player`: poll + nội suy, map error, state), `Html5PlayerAdapter.onStateChange`,
  `VideoFrame` (chọn nhánh theo provider, mode compact), `LocalVideoSource` (chọn file → callback),
  `Dialog` (zoom bắt checkbox), nút ‹ › (biên đầu/cuối), `useWakeLock` (mock navigator).
- Shared/core: zod `local`; core `local → ready`.
- pgTAP: `007_local_video.sql`; community matrix (§4.1).
- E2E: `smoke.spec.ts` giữ nguyên · `share.spec.ts` share → tab Cộng đồng → ngừng share
  (idempotent) · `mobile.spec.ts` iPhone 13 portrait + landscape (dock ẩn landscape, compact khi
  cuộn, ‹ ›) · `pwa.spec.ts` chạy trên `next build && next start` (đăng ký SW, `setOffline` →
  `/offline`); ghi vào CLAUDE.md rằng e2e PWA cần build riêng, không chạy cùng dev server.
- YouTube và video local file thật kiểm tay trên điện thoại (iOS Files/Photos, không autoplay,
  Add to Home Screen).

## 8. Thứ tự triển khai (1 plan, 5 khối)
1. Video local: 0009 + shared + core + mcp guard + skill + web (`LocalVideoSource`, badge).
2. `VideoFrame` + `onStateChange` + `YouTubePlayerAdapter`.
3. `Dialog` + share community + badge/“bởi”.
4. Polish mobile M1→M7 (M5/M6 dựa trên `onStateChange` và `VideoFrame`).
5. Service worker + `/offline` + registrar + e2e PWA.

## 9. Rủi ro & ghi chú
- iOS Safari `<input type=file accept="video/*">` từ Photos có thể trả bản transcode (HEVC → H.264)
  → size lệch `video_size_bytes`; vì vậy kiểm tra khớp chỉ cảnh báo, ưu tiên duration.
- Object URL của file lớn không tốn RAM (stream từ disk), nhưng Safari giới hạn seek trên file
  chưa được index — chấp nhận, đa số MP4 faststart từ Zoom OK.
- YouTube IFrame API thay đổi/chặn embed ngoài tầm kiểm soát; đã có nhánh lỗi 101/150.
- SW viết tay không có precache manifest của Next → lần đầu offline chỉ có `/offline`; các trang đã
  ghé sẽ mở lại được từ cache (dữ liệu Supabase vẫn cần mạng). Đúng với mục tiêu "app shell +
  fallback", không hứa offline dữ liệu.
- Turbopack + `public/sw.js`: file tĩnh, không qua bundler → không rủi ro tương thích.
