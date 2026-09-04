---
name: study-kit
description: Tạo bài học ngoại ngữ trên Vingo từ video (Zoom recording / YouTube / video có link / file local) — video + phụ đề 2 ngôn ngữ sync theo câu + từ vựng chọn lọc. Dùng khi người dùng đưa link/ID Zoom, link YouTube, link/file video và muốn "tạo bài học", "làm video học tiếng Nhật", "add bài lên Vingo". Kết nối qua remote MCP study-kit-mcp; mọi rule biên tập sống ở server (get_authoring_guide).
---

# study-kit → Vingo

Orchestration local, mỏng. **Không chứa rule biên tập** — rule sống server-side, luôn gọi
`get_authoring_guide` và làm theo. DB là bản chuẩn; lesson JSON local chỉ là nháp một chiều.
Sửa nội dung sau khi tạo → sửa trên web (không có `update_lesson`).

## Điều kiện kết nối

Cần MCP `study-kit` đã add + login (OAuth pairing). Nếu `whoami` lỗi/chưa có tool:
1. Vào Vingo `/settings` → **Tạo mã ghép nối** (code 8 ký tự, sống 10').
2. `claude mcp add --transport http study-kit <MCP_URL>` (URL từ trang Settings).
3. `claude mcp login study-kit` → dán code vào trang hiện ra.

## Quy trình (cố định)

1. **`whoami`** — xác nhận kết nối. Fail → hướng dẫn add/login ở trên rồi dừng.

2. **`get_authoring_guide`** — LUÔN gọi trước khi dựng bài. Làm đúng theo guide (schema, chuẩn
   hoá cues, biên tập transcript, chọn vocab, privacy). Không tự chế rule.

3. **Thu thập transcript** (2 ưu tiên, KHÔNG có fallback thứ 3):
   - **Có sẵn**: Zoom (`get_recording_transcript` — yêu cầu `has_transcript: true`); YouTube
     (video-download-mcp `download_transcript` → poll → tải file sub srt/vtt có timestamp);
     hoặc user đưa trực tiếp (link direct / dán / file local, mọi format có mốc giờ).
   - **STT MCP** user có trong phiên (Soniox / ElevenLabs Scribe…) khi không có sẵn.
   - **Không có cả hai → DỪNG**, báo cần transcript có timestamp hoặc STT MCP.
   - **Ràng buộc cứng**: transcript PHẢI có timestamp (không có thì không sync câu — không tạo bài).

4. **Dựng lesson JSON nháp** (uuid client sinh cho lesson + mỗi cue + mỗi vocab) theo guide.
   Gọi **`get_known_words(lang)`** để loại từ đã thuộc khỏi vocab.

5. **`create_lesson({ lesson })`** → nhận `{ lesson_id, web_url, video_next_step, already_exists }`.
   - `already_exists: true` (bài đã ready/processing) → không đè; muốn sửa thì sửa trên web.

6. **Video**:
   - **YouTube**: xong luôn (không có video file, bài đã `ready`).
   - **Đường A (ưu tiên)** — có direct-download link: `ingest_video_from_url({ lesson_id, url })`.
     - Zoom: lấy URL qua `get_recording_video_url` layout `gallery_view` (tránh bản `(CC)`) rồi
       gọi ingest **NGAY** (token URL sống ~1h).
     - Video trên platform user có quyền: video-download-mcp `start_download` → presigned URL
       MinIO → đưa vào đường A.
     - Link dạng **trang share** (Google Drive/Dropbox) KHÔNG phải direct link → kiểm tra và
       yêu cầu direct link.
   - **Đường B** — file local (chỉ desktop CLI):
     `request_video_upload({ lesson_id, kind: "video", size, content_type })` → 
     `curl -X PUT --upload-file "<file>" "<signed_url>"` (Bash timeout **600000ms** hoặc
     `run_in_background`; đứt mạng → xin URL mới) → `finalize_lesson({ lesson_id })`.
     Mạng yếu: dùng `scripts/tus-upload.mjs` (chunk 6MB, resume) thay curl.

7. **Poll `get_ingest_status({ lesson_id })`** mỗi 10–20s tới `ready`/`error`.
   - `error` → báo `ingest_error` + hướng retry: gọi lại `ingest_video_from_url` (đường A) hoặc
     `finalize_lesson` (đường B, upload lại nếu file hỏng).

8. **Trả `web_url`** cho user (mở bài trên web, video phát + seek bình thường).

## Lưu ý

- Không in/log token trong URL tải Zoom; URL chỉ để đưa vào ingest ngay rồi bỏ.
- Số/tiền/tên từ auto-caption dễ sai → theo guide đánh `uncertain` khi chưa chắc.
- Nguồn họp nội bộ: ẩn tên khách hàng / thông tin nhạy cảm (guide mục Privacy). Bài zoom mặc
  định private — chỉ share community khi người trong video đã đồng ý (làm trên web).
