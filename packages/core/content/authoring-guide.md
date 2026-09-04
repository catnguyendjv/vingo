# Vingo — Hướng dẫn tạo bài (authoring guide)

Đây là nguồn sự thật cho việc dựng lesson JSON. Skill LUÔN gọi `get_authoring_guide`
trước khi biên tập, và làm đúng theo đây — không tự chế rule.

Nguyên tắc lớn: phần giá trị nhất của một bài là **làm ngôn ngữ kỹ** (biên tập caption cho
đúng nghĩa, dịch tự nhiên, chọn từ đáng học). Việc kỹ thuật (tải/transcode video, thumbnail)
đã do server lo — đừng bận tâm.

---

## 1. Schema lesson JSON

Đồng bộ với `lessonJsonSchema` (`@vingo/shared`). `create_lesson` validate zod và từ chối nếu sai.

```jsonc
{
  "id": "uuid-v4",                 // client sinh, ỔN ĐỊNH vĩnh viễn (sửa bài không mất tiến độ)
  "title": "Tiêu đề bài",
  "lesson_date": "2026-09-04",     // optional, YYYY-MM-DD
  "source_type": "zoom",           // 'zoom' | 'youtube' | 'upload'
  "source_ref": "zoom uuid / youtube url / tên file",  // optional
  "source_lang": "ja",             // BCP-47 ngắn: ja, vi, en...
  "target_lang": "vi",
  "video_provider": "youtube",     // optional: 'storage' | 'youtube'
  "video_ref": "dQw4w9WgXcQ",      // optional: youtube video id (khi provider=youtube)
  "duration_sec": 1830,            // optional (server đo lại khi ingest storage)
  "cues": [
    {
      "id": "uuid-v4",             // client sinh, ỔN ĐỊNH
      "idx": 1,                    // liên tục từ 1, không trùng
      "start_ms": 158000,          // mốc giờ tính từ đầu video, mili-giây
      "end_ms": 168000,            // BẮT BUỘC start_ms < end_ms
      "text_source": "決済は問題ないんですけど…",  // câu nguồn đã biên tập
      "text_target": "Phần thanh toán thì ổn…",   // optional: bản dịch
      "uncertain": false,          // optional: true nếu nghe không chắc → web hiện ⚠
      "note": "⚠ ghi chú"          // optional
    }
  ],
  "vocab": [
    {
      "id": "uuid-v4",
      "cue_id": "uuid của cue chứa từ",  // phải trỏ một cue có trong mảng cues
      "term": "決済",
      "reading": "けっさい",        // optional: yomi/pinyin/romaji (để trống với EN)
      "meaning": "thanh toán / duyệt chi",
      "sort": 1                    // optional
    }
  ]
}
```

Ràng buộc schema (zod tự kiểm): cue `id` không trùng, `idx` không trùng, mọi `vocab.cue_id`
phải là một `cue.id` có thật, ít nhất 1 cue.

### Ví dụ hoàn chỉnh (tối giản)

```json
{
  "id": "3f2a...uuid",
  "title": "Họp sprint — review release",
  "lesson_date": "2026-09-01",
  "source_type": "zoom",
  "source_lang": "ja",
  "target_lang": "vi",
  "video_provider": "storage",
  "cues": [
    { "id": "c1...uuid", "idx": 1, "start_ms": 0, "end_ms": 4200,
      "text_source": "とりあえずリリースは来週で大丈夫ですか？",
      "text_target": "Trước mắt release vào tuần sau có ổn không ạ?" },
    { "id": "c2...uuid", "idx": 2, "start_ms": 4200, "end_ms": 9000,
      "text_source": "なるほど、じゃあ検証環境で先に確認しましょう。",
      "text_target": "Ra vậy, thế thì kiểm tra trước trên môi trường verify nhé." }
  ],
  "vocab": [
    { "id": "v1...uuid", "cue_id": "c1...uuid", "term": "とりあえず", "reading": "とりあえず",
      "meaning": "trước mắt / tạm thời" },
    { "id": "v2...uuid", "cue_id": "c2...uuid", "term": "検証環境", "reading": "けんしょうかんきょう",
      "meaning": "môi trường kiểm thử / verify" }
  ]
}
```

---

## 2. Chuẩn hoá cues (từ transcript có timestamp)

- **Dedup rolling caption** (auto-sub YouTube): auto-sub thường lặp dồn từng dòng (mỗi dòng
  thêm vài chữ so với dòng trước). Gộp về câu đầy đủ một lần, bỏ các dòng chồng lặp.
- **Gộp/tách thành câu tự nhiên** giữ timestamp: một cue = một câu/ý trọn vẹn. Khi gộp nhiều
  segment, lấy `start_ms` của segment đầu và `end_ms` của segment cuối. Khi tách, chia mốc giờ
  hợp lý theo độ dài.
- `start_ms < end_ms` cho mọi cue; các cue không cần liền mạch nhưng nên theo thứ tự thời gian.
- `idx` liên tục từ 1, không trùng.

---

## 3. Biên tập transcript (text_source + text_target)

- **Sửa lỗi auto-caption** theo ngữ cảnh: số/đơn vị nghe nhầm (`6420人` → `6420円`), katakana
  nghe nhầm (`ベテム` → `ベトナム`), từ đồng âm sai (`身長` → `進捗`), tên người viết sai.
  Giữ **giọng văn nói** tự nhiên, đừng viết lại thành văn viết trang trọng.
- Chỗ **không chắc** (tên riêng, con số, câu mờ): đặt `uncertain: true` + `note: "⚠ …"` để
  người học không học nhầm. Web hiển thị dấu ⚠.
- `text_target`: dịch tự nhiên, gọn, đúng nghĩa hội thoại (không dịch máy từng chữ).

---

## 4. Chọn vocab

- **Số lượng**: 0–5 từ/câu. Gắn từ ở **câu nó xuất hiện lần đầu** (cue_id của câu đó).
- **Loại bỏ trước**: từ đã có trong `get_known_words(lang)` (đừng bắt học lại), từ quá cơ bản
  (mức N5 với tiếng Nhật), và tên riêng.
- **Thứ tự ưu tiên khi còn slot**:
  1. Hội thoại đời sống hàng ngày (なるべく, ちょっと待って, とりあえず, そのうち…).
  2. Cảm thán / phản ứng / aizuchi (なるほど, さすが, えっと, やっぱり, しまった, ちなみに…) —
     auto-caption hay bỏ qua nhưng nghe họp gặp liên tục → luôn nhặt khi xuất hiện.
  3. Thuật ngữ IT / kỹ thuật (デプロイ, 仕様, 不具合, 検証環境, リリース, 本番, 改修…).
  4. Business/keigo chung chung — chỉ lấy khi còn slot và từ thật sự đáng học.
- `reading`: yomi (hiragana) cho tiếng Nhật; pinyin/romanization cho ngôn ngữ khác; để trống
  với tiếng Anh. `meaning`: nghĩa tiếng Việt gọn.

---

## 5. Ràng buộc cứng: transcript phải có timestamp

Sync câu với video là giá trị cốt lõi của app. **Không có timestamp thì KHÔNG tạo bài.**
Nếu nguồn chỉ có văn bản trơn không mốc giờ → dừng, báo cần transcript có timestamp hoặc dùng
STT MCP (Soniox / ElevenLabs Scribe…) để sinh segment có mốc giờ.

---

## 6. Privacy (nguồn là họp nội bộ)

Khi biên tập transcript cuộc họp nội bộ: **ẩn/bỏ tên khách hàng và thông tin dự án nhạy cảm**.
Ưu tiên giữ giá trị học ngôn ngữ; thay danh từ riêng nhạy cảm bằng dạng chung chung khi cần.
Bài nguồn zoom mặc định private — chỉ share community khi người trong video đã đồng ý.
