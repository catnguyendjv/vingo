# Vingo P1.5 — SRS ôn tập từ vựng (Design Spec)

Ngày: 2026-09-08. Bổ sung cho spec master `2026-08-28-vingo-design.md` §6.3 (SRS) và §3 (schema
`review_cards`/`review_logs`). Khi lệch nhau, spec này thắng cho phạm vi P1.5.

## 1. Mục tiêu & phạm vi

### 1.1 Mục tiêu
Người học đưa từ vựng vào ôn tập theo FSRS và ôn hằng ngày trên `/review` (mobile trước), với
câu ví dụ lấy từ chính video đã học. Dữ liệu vẫn ở Supabase local; không phụ thuộc deploy.

### 1.2 Quyết định đã chốt (2026-09-08)
| # | Quyết định |
|---|---|
| S-1 | Engine `ts-fsrs` **5.x**, chạy **trên client** (browser). Tham số mặc định (retention 0.9, fuzz bật). Ghi DB qua RPC nhỏ để card + log nguyên tử. Không viết FSRS trong plpgsql, không dùng Server Actions |
| S-2 | Thẻ ôn có **câu ví dụ** (câu nguồn + dịch) và link "Mở trong bài" tới đúng câu. Không phát video trong màn ôn (để P2 nếu cần) |
| S-3 | Lối vào: link **"Ôn tập" trên header + badge số thẻ đến hạn** (tính lúc render server, không realtime). Không có banner ở thư viện |
| S-4 | Enroll ở **3 chỗ**: flashcard trên trang học (per-từ), nút "Đưa cả bài vào ôn tập" (trừ từ đã thuộc), và **per-từ trong Từ điển** kèm cột/chip "đang ôn". Không có chọn nhiều dòng |
| S-5 | Cap **20 thẻ mới / 24 giờ trượt** (không theo ngày lịch) để tránh lệch timezone server ↔ browser |
| S-6 | Undo chỉ cho **lần review cuối, trong phiên**, bằng snapshot card trước đó (không cần `fsrs.rollback`) |
| S-7 | Thêm cột `review_cards.source_cue_id` để lưu câu ví dụ lúc enroll (schema master §3 không có) |
| S-8 | Đồng bộ known_words → card bằng **trigger DB**, không phải logic client |

### 1.3 Điều kiện xong
Trên local: đưa từ vào ôn từ cả 3 chỗ → header hiện badge → `/review` ôn hết hàng đợi (due
trước, New sau, tối đa 20 New/24h) với 4 nút + Undo → đánh dấu "đã thuộc" ở trang học/từ điển
làm thẻ biến mất khỏi hàng đợi và ngược lại → `pnpm -r test`, `supabase test db`, `pnpm e2e` xanh.

### 1.4 Ngoài phạm vi
Video trong màn ôn · banner nhắc ở thư viện · chọn nhiều dòng từ điển · tuỳ chỉnh retention /
tham số FSRS · optimizer · thống kê lịch sử · Undo nhiều bước · realtime badge · P2 (YouTube,
share, service worker).

## 2. Dữ liệu & RPC — migration `0008_srs.sql`

Không đổi cấu trúc hiện có ngoài một cột mới. Mọi hàm là `security invoker` (RLS per-user hiện
có là chốt quyền), `set search_path = public`; cuối migration `revoke execute … from public, anon`
và `grant execute … to authenticated` theo mẫu `0006_grants.sql`.

### 2.1 Cột mới
```
alter table review_cards add column source_cue_id uuid references cues(id) on delete set null;
```

### 2.2 Trigger đồng bộ known_words → review_cards
- `after insert on known_words` → `update review_cards set suspended = true`
  where cùng `(user_id, lang, term)`.
- `after delete on known_words` → `update review_cards set suspended = false` cùng khoá.
- Hàm trigger `security invoker` (chạy dưới RLS của user đang thao tác; chỉ đụng hàng của chính
  họ). Áp dụng cho mọi đường ghi known_words (trang học, từ điển, MCP sau này).

### 2.3 `enroll_cards(items jsonb) returns table(created int, reactivated int)`
- `items` = mảng `{lang, term, reading, meaning, lesson_id, cue_id}`; `reading/meaning/lesson_id/cue_id`
  có thể null. Bỏ qua item thiếu `lang` hoặc `term`.
- Với mỗi item: `delete from known_words where user_id = auth.uid() and (lang, term) = …`
  (trigger 2.2 sẽ unsuspend nếu card đã có), rồi
  `insert into review_cards (user_id, lang, term, reading, meaning, source_lesson_id, source_cue_id, due_at)
   values (auth.uid(), …, now()) on conflict (user_id, lang, term) do update set suspended = false`.
  **First-wins**: card có sẵn giữ nguyên lịch, reading/meaning, nguồn.
- Trả `created` (insert mới) và `reactivated` (đã có, chỉ bật lại). Client dùng để hiện thông báo
  ("Đã thêm 12 từ, 3 từ đã có").
- Client lọc: "Đưa cả bài" chỉ gửi từ chưa thuộc và chưa trong ôn tập; per-từ trên từ đã thuộc
  gửi thẳng (RPC gỡ known).

### 2.4 `review_card(p_card_id uuid, p_rating smallint, p_card jsonb, p_log jsonb) returns review_cards`
- `p_card` = các cột lịch mới do client tính: `due_at, stability, difficulty, scheduled_days,
  learning_steps, reps, lapses, state, last_review_at`. Hàm chỉ cập nhật đúng các cột này (không
  cho đổi `term/lang/user_id/suspended`).
- Trong cùng transaction: `update review_cards … where id = p_card_id and user_id = auth.uid()`;
  nếu không có hàng → `raise exception 'card not found'`. Rồi
  `insert into review_logs (card_id, user_id, rating, reviewed_at, log)` với `log = p_log`
  (nguyên `ReviewLog` của ts-fsrs, ngày ở dạng ISO string) và `reviewed_at = (p_log->>'review')::timestamptz`.
- Trả hàng card sau update.

### 2.5 `undo_review(p_card_id uuid, p_card jsonb) returns review_cards`
- Xoá **một** hàng `review_logs` mới nhất (theo `reviewed_at desc, id desc`) của card; nếu
  không có → raise. Cập nhật card về `p_card` (cùng danh sách cột như 2.4). Trả card.

### 2.6 `review_stats() returns table(due int, new_available int, new_last_24h int)`
- `due`: card của user, `suspended = false`, `state <> 'New'`, `due_at <= now()`.
- `new_available`: `suspended = false`, `state = 'New'`.
- `new_last_24h`: `count(review_logs)` của user với `reviewed_at > now() - interval '24 hours'`
  và `(log->>'state')::int = 0` (ReviewLog.state là state **trước** khi review; 0 = New).
- Header dùng badge = `due + least(new_available, greatest(0, 20 - new_last_24h))`.

### 2.7 `review_queue() returns table(…)`
Trả hàng đợi đã áp cap, join sẵn ngữ cảnh:
```
id, lang, term, reading, meaning, due_at, stability, difficulty, scheduled_days, learning_steps,
reps, lapses, state, last_review_at, created_at,
source_lesson_id, lesson_title, source_cue_id, cue_idx, cue_text_source, cue_text_target
```
- Phần (a): mọi card `suspended = false and state <> 'New' and due_at <= now()`.
- Phần (b): card `suspended = false and state = 'New'` sắp `created_at asc`, `limit greatest(0, 20 - new_last_24h)`.
- `left join lessons l on l.id = source_lesson_id and l.deleted_at is null`, `left join cues c on
  c.id = source_cue_id`. Bài đã xoá / mất quyền đọc (RLS trên `lessons`/`cues` tự lọc) → các cột
  ngữ cảnh null, thẻ vẫn ôn được.

### 2.8 `my_dictionary()` thêm cột `in_review boolean`
- `exists (select 1 from review_cards rc where rc.user_id = auth.uid() and rc.lang = v.lang
  and rc.term = v.term and rc.suspended = false)`.
- Đổi kiểu trả về nên phải `drop function public.my_dictionary()` rồi tạo lại nguyên văn + cột
  mới, revoke/grant lại.

### 2.9 pgTAP `supabase/tests/006_srs.sql`
- RLS: user B gọi `review_card`/`undo_review` trên card của A → lỗi; `review_queue`/`review_stats`
  của B không thấy card của A.
- Trigger: insert known_words → card `suspended = true`; delete → `false`.
- `enroll_cards`: từ đã thuộc → known_words bị xoá, card tạo với `suspended = false`; gọi lại
  cùng term sau khi đã review → lịch không đổi, `reactivated = 1`.
- `review_card`: card + log ghi cùng lúc; `review_stats.new_last_24h` tăng khi log state = 0.
- `undo_review`: chỉ xoá log mới nhất, card về snapshot.
- `review_queue`: cap New đúng; card suspended không xuất hiện; card bài đã soft-delete vẫn có
  hàng nhưng `lesson_title` null.
- `my_dictionary().in_review` đúng với card active/suspended/không có.

## 3. Hàng đợi phiên ôn & map ts-fsrs — `apps/web/src/lib/srs.ts`

Module thuần (không React), có `srs.test.ts`.

- **Phụ thuộc:** `ts-fsrs@^5` trong `apps/web/package.json`. Lúc triển khai đọc `.d.ts` trong
  `node_modules` để khớp tên trường chính xác (Card/ReviewLog/State/Rating) — không đoán API.
- **`toFsrsCard(row, now): Card`**: `due = due_at`, `last_review = last_review_at ?? undefined`,
  `state = State[row.state]` (chuỗi → enum), `elapsed_days = state New ? 0 : số ngày nguyên từ
  last_review_at tới now` (schema cố ý không lưu cột này), còn lại map 1-1; null → 0.
- **`fromFsrsCard(card): CardPatch`**: ngược lại, `state` về chuỗi `State[card.state]`, ngày về
  ISO string. Đây chính là `p_card` cho RPC.
- **`serializeLog(log): Json`**: ReviewLog với ngày ISO — chính là `p_log`.
- **`scheduleOptions(card, now)`**: gọi `f.repeat(card, now)` → 4 lựa chọn `{rating, card, log,
  intervalLabel}`; `intervalLabel` = khoảng cách `card.due - now` qua `formatInterval(ms)` trong
  `lib/format.ts` ("<1 phút", "10 phút", "3 giờ", "3 ngày", "2 tháng", "1,5 năm").
- **`buildQueue(rows, now): QueueItem[]`**: due (state ≠ New) theo `due_at` tăng dần rồi New theo
  `created_at`. Server đã áp cap; client chỉ sắp thứ tự.
- **`requeueAfterReview(queue, item, nextDueAt, now)`**: nếu `nextDueAt - now < 15 phút` → đẩy item
  (với card đã cập nhật) về cuối hàng đợi; ngược lại bỏ khỏi phiên. Khi tới lượt hiện ngay dù chưa
  đúng giờ (không timer).
- `RATINGS = [Again, Hard, Good, Easy]` với nhãn tiếng Việt "Quên / Khó / Được / Dễ" và phím 1–4.

## 4. UI

### 4.1 Header & layout
- `(app)/layout.tsx` (server) gọi `review_stats()` một lần mỗi request, tính badge theo 2.6, truyền
  `reviewDue: number` vào `AppHeader`. Chưa đăng nhập hoặc RPC lỗi → 0.
- `AppHeader` thêm link **Ôn tập** (`復習` lang=ja) trước Từ điển, icon `repeat` (thêm vào `Icon`
  nếu chưa có), `Badge` số due khi > 0, hiển thị "99+" khi vượt. `data-testid="review-nav"`,
  badge `data-testid="review-badge"`.

### 4.2 Route `/review`
- `app/(app)/review/page.tsx` (server): auth guard như các trang khác; gọi `review_queue()` +
  `review_stats()`; render `components/review/ReviewSession.tsx` (client) với `initialQueue`,
  `stats`, `userId`.
- **`ReviewSession`** giữ toàn bộ state: hàng đợi, thẻ hiện tại, `revealed`, snapshot Undo
  `{cardId, prevPatch}`, `reviewedCount`, `pending` (đang gọi RPC). Con chỉ nhận props:
  - `ReviewProgress` — thanh đầu: "12 / 27", số due còn, số New còn, nút Undo (`review-undo`, disabled
    khi không có snapshot hoặc đang pending).
  - `ReviewCard` — thẻ lật (`review-card`, `data-revealed`). Không dùng lại `ui/Flashcard` (API gắn
    với known/hover), nhưng dùng cùng class `.fc/.fc-front/.fc-back` và token. Mặt trước: chip
    trạng thái (New/Learning/Review/Relearning → "Mới/Đang học/Ôn/Học lại"), term lớn `lang="ja"
    font-jp`. Mặt sau: reading, meaning, khối câu ví dụ (`text_source` lang=ja + `text_target`) và
    link "Mở trong bài" → `/lessons/<id>#cueid=<cue_id>` (cơ chế seek đã có trong StudyView); ẩn
    khối này khi ngữ cảnh null.
  - `ReviewActions` — trước khi lật: một nút lớn "Hiện đáp án"; sau khi lật: 4 nút
    `review-rating-1..4`, mỗi nút có nhãn + `intervalLabel`. Mobile: `fixed bottom` cùng kiểu
    `MobileDock`; `lg:` nằm ngay dưới thẻ. Thẻ + nút căn giữa, `max-w-[560px]`.
- Tương tác: chạm/click thẻ hoặc Space → lật; 1–4 → chấm (chỉ khi đã lật); Z → Undo. Chấm xong
  thẻ kế hiện mặt trước ngay, không animation dài.
- Chấm: `scheduleOptions` → chọn → optimistic chuyển thẻ, gọi `review_card`. Lỗi → toast lỗi
  (dùng pattern thông báo đơn giản, `role="alert"`), trả thẻ về **đầu** hàng đợi, giữ snapshot cũ.
- Undo: gọi `undo_review(cardId, prevPatch)` → chèn lại thẻ về đầu hàng đợi ở mặt trước, giảm
  `reviewedCount`, xoá snapshot. Chỉ 1 bước.
- Trạng thái rỗng (`review-empty`): (a) `stats.new_available + due == 0` và không có card nào →
  hướng dẫn 3 chỗ enroll + link về thư viện, từ điển; (b) hết hàng đợi → "Xong phiên hôm nay",
  số thẻ đã ôn, giờ thẻ gần nhất đến hạn (query nhỏ `min(due_at)` của card active chưa due, lấy
  ở server và truyền xuống).

### 4.3 Trang học — enroll
- `lessons/[id]/page.tsx` lấy thêm `review_cards.term` của user với `lang = source_lang` và
  `suspended = false` → prop `initialReviewTerms`.
- `StudyView` thêm state `reviewTerms: Set<string>`, hàm `enrollTerm(v)` (gửi 1 item) và
  `enrollLesson()` (gửi mọi từ chưa thuộc & chưa trong ôn tập, dedupe theo term; hiện thông báo
  "Đã thêm N từ" / "Không còn từ nào để thêm").
- `Flashcard` thêm props tuỳ chọn `inReview?: boolean; onEnroll?: () => void`: mặt sau thêm nút
  "Ôn tập" (`data-testid="flashcard-enroll"`); khi `inReview` hiện chip "Đang ôn" thay nút. Mặt
  trước không đổi (click hover-capable vẫn là toggleKnown).
- `VocabPanel` nhận `reviewTerms`, `onEnroll`, `onEnrollAll`; header thêm nút "Đưa cả bài vào ôn
  tập" (`data-testid="enroll-all"`, disabled khi không còn từ nào), hiện cả desktop và mobile.
- Đánh dấu "đã thuộc" một từ đang ôn: client cập nhật `reviewTerms` (bỏ term) để chip đổi ngay;
  DB do trigger lo. Bỏ đánh dấu: nếu card từng tồn tại thì trigger unsuspend, client không biết →
  chấp nhận lệch nhỏ tới lần reload (không hiển thị "Đang ôn" cho tới khi reload).

### 4.4 Từ điển — enroll
- `DictEntry` thêm `in_review: boolean`; `DictionaryTable` giữ `Set` `inReview` như `known`.
- Desktop: thêm cột "Ôn tập" với nút nhỏ `Button size="sm"` "Ôn tập" (`data-testid="dict-enroll"`)
  hoặc chip "Đang ôn". Mobile: nút/chip nằm cùng hàng với ×N và "mở câu".
- Enroll gọi `enroll_cards` với `lesson_id = lesson_ids[0]`, `cue_id = cue_ids[0]`; nếu từ đang
  known thì client cũng bỏ khỏi `known` (RPC đã gỡ). Đánh dấu known → bỏ khỏi `inReview` (trigger).
- Bộ lọc giữ 3 giá trị hiện có; không thêm lọc "đang ôn" (YAGNI).

## 5. Kiểm thử
- **Vitest thuần:** `lib/srs.test.ts` (round-trip row → Card → repeat → patch ghi được; elapsed_days
  suy ra đúng; buildQueue thứ tự; requeue < 15 phút; formatInterval các mốc).
- **Vitest jsdom:** `ReviewSession.test.tsx` với supabase client mock (lật, chấm, undo, lỗi RPC trả
  thẻ về đầu, phím tắt, trạng thái rỗng); `Flashcard.test.tsx` bổ sung nút Ôn tập/chip Đang ôn;
  `DictionaryTable` chip/nút enroll.
- **pgTAP:** `006_srs.sql` theo 2.9.
- **Playwright** `e2e/smoke.spec.ts` bổ sung, idempotent: từ trang học enroll 1 từ → header có
  `review-badge` → `/review` lật + chấm Good → Undo → cuối cùng xoá card đã tạo qua client
  (delete `review_cards` theo term) để trả trạng thái.

## 6. Rủi ro & ghi chú
- ts-fsrs 5.x đổi tên trường giữa minor (vd `learning_steps` xuất hiện từ 5.0): pin `^5`, unit test
  round-trip bắt lệch; khi lên 6.x (bỏ `elapsed_days`) chỉ sửa `toFsrsCard`.
- `(log->>'state')::int = 0` phụ thuộc hình dạng ReviewLog của lib; pgTAP + unit test cùng khoá
  giả định này. Nếu lib đổi, sửa `serializeLog` để giữ `state` số.
- Badge tính mỗi request ở layout: một RPC nhỏ có index `(user_id, due_at)`, chấp nhận.
- Homograph cùng ngôn ngữ gộp theo term (product decision MVP, giữ nguyên từ spec master).
