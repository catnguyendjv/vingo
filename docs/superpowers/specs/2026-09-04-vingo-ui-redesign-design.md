# Vingo — Thiết kế lại giao diện web (Design Spec)

Ngày: 2026-09-04. Trạng thái: đã duyệt hướng thẩm mỹ "Ấm áp kem đất" (chọn từ 5 hướng dựng mockup độc lập).
Mockup tham chiếu thị giác: `docs/superpowers/specs/assets/2026-09-04-vingo-ui-warm-mockup.html`
(mở trực tiếp trong trình duyệt; nút tròn góc phải dưới để đổi sáng/tối). Khi spec và mockup lệch nhau
về **hành vi** thì spec thắng; lệch về **thị giác** (khoảng cách, bo góc, màu) thì mockup thắng.

Spec này bổ sung cho `2026-08-28-vingo-design.md` (mục 6 Web app). Không đổi schema, RLS, player
adapter, cue-sync hay luồng dữ liệu Supabase — chỉ đổi lớp trình bày và thêm 2 khả năng nhỏ:
đổi theme sáng/tối và flashcard lật mặt cho từ vựng.

## 1. Mục tiêu & phạm vi

### 1.1 Mục tiêu
- Giao diện trông như sản phẩm hoàn thiện, có bản sắc riêng, thân thiện nhưng không trẻ con.
- Light và dark **ngang hàng** về chất lượng; người dùng chọn được, mặc định theo hệ điều hành.
- Học trên điện thoại thoải mái: video ghim trên khi cuộn câu, nút bấm được bằng ngón cái, chữ Nhật
  đủ to.
- Panel 200+ từ vựng quản lý được; từ vựng là flashcard lật mặt để ôn nhanh ngay trong trang học.

### 1.2 Quyết định đã chốt
| # | Quyết định |
|---|---|
| 1 | Hướng thẩm mỹ: "Ấm áp kem đất" — nền kem / nâu đen ấm, cam đất dẫn mắt, xanh ngọc cho "đã học" |
| 2 | Font: **Be Vietnam Pro** (UI tiếng Việt) + **Zen Kaku Gothic New** (tiếng Nhật), tải qua `next/font/google` |
| 3 | Theme: `data-theme="light"\|"dark"` trên `<html>`; không có attribute = theo hệ. Lưu bằng **cookie** `vingo-theme` (1 năm, SameSite=Lax) để server render đúng theme từ HTML đầu tiên, không nháy |
| 4 | Token màu là CSS variables trên `:root`, map vào Tailwind v4 qua `@theme inline`. Component chỉ dùng token, không hard-code màu |
| 5 | Không thêm thư viện UI/icon. Icon là SVG inline kiểu lucide (stroke 1.9) gom trong một component `Icon` |
| 6 | Từ vựng = flashcard 2 mặt. Desktop: hover/focus lật, click đánh dấu đã thuộc. Mobile: chạm lật, mặt sau có nút "✓ Đã thuộc". Không dùng long-press |
| 7 | Trang học mobile: video `position: sticky` + segmented "Câu / Từ vựng" + dock 5 nút cố định đáy. **Chưa làm** mini-player thu nhỏ khi cuộn |
| 8 | Không có chức năng mới nào khác ngoài #3 và #6. SRS, YouTube player, share community, settings vẫn ở phase sau |

### 1.3 Ngoài phạm vi
- Mini-player / picture-in-picture khi cuộn (xem lại sau khi dùng thật).
- Thay đổi câu chữ nhãn chức năng ngoài việc rút gọn cho vừa nút mobile (bảng nhãn ở mục 4.3).
- Trang `/review`, `/settings`, manifest PWA (P1 theo spec gốc).

## 2. Hệ thống thiết kế

### 2.1 Token màu
Mọi giá trị dưới đây là bắt buộc (đã kiểm tra tương phản AA cho text/muted trên bg/surface ở cả 2 theme).

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `canvas` | `#F1EAE0` | `#141110` | nền ngoài cùng của body |
| `bg` | `#FAF6F0` | `#1C1714` | nền khung app / header |
| `surface` | `#FFFFFF` | `#26201C` | card, panel, input, nút thường |
| `surface-2` | `#F3ECE3` | `#2F2721` | khay segmented, hover, thead, nút soft |
| `text` | `#2B2118` | `#F3EAE1` | chữ chính |
| `muted` | `#7A6A5C` | `#A89684` | chữ phụ, nhãn, icon nghỉ |
| `border` | `#EADFD3` | `#3A312B` | viền 1px |
| `accent` | `#B84A22` | `#E8825A` | nút primary, toggle bật, link, dòng từ vựng trong câu, thanh câu đang phát |
| `accent-fg` | `#FFFFFF` | `#1C1714` | chữ trên nền accent |
| `accent-soft` | `#FBE7DC` | `#3D2A20` | nền toggle bật, chip câu đang phát, badge "Tiếp tục" |
| `active-cue` | `#FFF1E6` | `#3B2A21` | nền câu đang phát |
| `success` / `success-soft` | `#18806A` / `#DDF1EA` | `#4CC0A0` / `#1F3A33` | đã học, đã thuộc, badge Xong |
| `warning` / `warning-soft` | `#955F12` / `#FBEFD6` | `#E0A84A` / `#3B2F1C` | badge đang xử lý, ⚠ uncertain |
| `danger` / `danger-soft` | `#B3412F` / `#FADDD7` | `#E8735F` / `#43241F` | badge lỗi, ingest_error, nút ✕ xoá từ |
| `video` | `#1A120D` | `#0F0B09` | nền khung video / placeholder |

Bóng: `shadow` = `0 1px 2px rgba(60,40,20,.05), 0 10px 28px -14px rgba(60,40,20,.22)` (dark:
`0 1px 2px rgba(0,0,0,.3), 0 12px 30px -14px rgba(0,0,0,.6)`); `shadow-sm` = `0 1px 2px rgba(60,40,20,.08)`
(dark `.35`). Đặt `color-scheme: light|dark` tương ứng để form control gốc và scrollbar đổi theo.

Cấu trúc CSS (bắt buộc đúng thứ tự để không có màu "chỉ tồn tại trong một theme"):
1. `:root { …light… }` đầy đủ mọi token.
2. `:root[data-theme="dark"] { …dark… }`.
3. `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { …dark… } }`.
4. `@theme inline { --color-bg: var(--bg); … --font-sans: var(--font-body); --font-jp: var(--font-jp); --radius-xl: 24px; … }`
   để dùng được `bg-surface`, `text-muted`, `border-border`, `font-jp`, `rounded-lg`… trong className.

### 2.2 Chữ
- `--font-body`: Be Vietnam Pro 400/500/600/700, fallback `system-ui, -apple-system, "Segoe UI", sans-serif`.
- `--font-jp`: Zen Kaku Gothic New 400/500/700, fallback `"Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif`;
  `font-feature-settings: "palt" 1`. Áp dụng qua `lang="ja"` hoặc class `font-jp` cho MỌI chuỗi tiếng Nhật
  (tiêu đề bài, câu, cách đọc, chip, cột 単語).
- Cỡ chữ: body 14px/1.5. Tiêu đề trang 22–24px/700, letter-spacing -0.02em. Tiêu đề bài (JP) 20px desktop.
  Câu JP **15.5px desktop / 17px mobile**, line-height 1.55; bản dịch VI 13px desktop / 13.5px mobile màu muted.
  Số liệu (tiến độ, thời lượng, ×N) dùng `tabular-nums`.
- `next/font/google` với `subsets: ["latin", "vietnamese"]` cho Be Vietnam Pro, `subsets: ["latin"]`
  + `preload: false` cho Zen Kaku Gothic New (font JP nặng; để trình duyệt tải khi gặp glyph). `display: "swap"`.

### 2.3 Bo góc, khoảng cách
`xl` 24px (khung login), `lg` 18px (card, panel, video), `md` 14px (input, cue item, chip lớn),
`sm` 10px (logo mark, checkbox), `pill` 999px (nút, badge, segmented). Khoảng cách theo thang 4px;
grid gap 20px (thư viện), 24px (trang học desktop). Nội dung tối đa 1200px, padding ngang 24px desktop /
16px mobile.

### 2.4 Component dùng chung (`apps/web/src/components/ui/`)
Mỗi component là một file, chỉ nhận props tối thiểu, style bằng className Tailwind từ token.

| Component | Hành vi / biến thể |
|---|---|
| `Button` | pill, min-height 40px (sm 34px), viền `border`, nền `surface`; `variant`: `default` \| `primary` (nền accent, chữ accent-fg, bóng màu accent) \| `soft` (nền surface-2, không viền) \| `ghost` (chỉ chữ muted). Prop `pressed` cho toggle: nền accent-soft, viền + chữ accent, đặt `aria-pressed`. Hover đổi nền surface-2 + viền muted; `:active` scale .98; focus ring 2px accent offset 2px |
| `IconButton` | 38px tròn, icon 18px, màu muted → text khi hover; dùng cho theme toggle, back, CSV mobile |
| `SegmentedControl` | khay surface-2 padding 4px; item chọn nền surface, chữ text, `shadow-sm`; là `<a>` (tab thư viện, giữ URL `?tab=`) hoặc `<button>` (tốc độ, Câu/Từ vựng, filter từ điển). Biến thể `tight` cho tốc độ |
| `Badge` | pill 12px/600, cặp `*-soft`/`*`: `learning` (accent) "Tiếp tục", `done` (success) "Xong", `draft` (surface-2/muted) "nháp — chưa có video", `processing` (warning) "đang xử lý video…", `error` (danger) "lỗi xử lý video" |
| `ProgressRing` | SVG r=15.5 stroke 3.4, `pathLength=100`, track `border`, fill `accent`, 100% → `success`; size 36px; biến thể có nhãn % ở giữa (dock, mobile) |
| `Card` | surface + border 1px, `rounded-lg`; nếu là link: hover `translateY(-3px)` + `shadow` |
| `Input` | height 44px, `rounded-md`, icon trái tuỳ chọn, focus viền accent + `box-shadow 0 0 0 3px accent-soft` |
| `Checkbox` | tự vẽ 26px (desktop) / 28px (mobile) bo 9px, tròn ở từ điển; checked = nền success + tick trắng; animation "pop" (scale .82→1.14→1, 350ms) khi chuyển sang checked |
| `Flashcard` | xem mục 4.4 |
| `ThemeToggle` | xem mục 3 |
| `Icon` | `name` → `<svg>` inline; bộ icon: play, book, sun, moon, log-out, calendar, video-off, alert-triangle, check, check-check, repeat, gauge, eye, eye-off, skip-forward, pencil, plus, x, search, download, arrow-up-right, chevron-down, chevron-left, users, flip |

Motion: 150–250ms, easing `cubic-bezier(.2,.8,.2,1)`. Đổi theme fade nền 250ms. Mọi transition/animation
tắt dưới `prefers-reduced-motion: reduce`. Không confetti, không âm thanh.

## 3. Theme sáng/tối

- Nguồn sự thật: cookie `vingo-theme` ∈ {`light`, `dark`}; không có cookie = theo hệ.
- Server (`app/layout.tsx`): đọc cookie qua `cookies()`, render `<html lang="vi" data-theme={theme}>`
  (bỏ attribute khi không có cookie). Vì vậy không cần script chống nháy.
- Client (`ThemeToggle`): nút icon sun/moon ở header (và trong khung login góc phải trên). Bấm →
  tính theme hiện tại (`data-theme` hoặc `matchMedia`) → đảo → set `document.documentElement.dataset.theme`
  → ghi cookie `vingo-theme=<v>; Path=/; Max-Age=31536000; SameSite=Lax`. Không gọi server, không reload.
- Icon hiển thị theo theme **đang hiệu lực** (kể cả khi theo hệ): dùng CSS ẩn/hiện sun/moon theo
  `[data-theme]` + media query như mockup, tránh lệch hydration.
- `<meta name="theme-color">` 2 giá trị theo media (`#FAF6F0` / `#1C1714`).

## 4. Màn hình

### 4.1 Khung app `(app)/layout.tsx`
Header 1 hàng, nền `bg`, border-bottom: trái logo (ô vuông 30px `accent` bo 10px chứa icon play trắng +
chữ "Vingo" 19px/700); phải: `navlink` "単語帳 Từ điển" (icon book, phần JP màu muted), `ThemeToggle`,
"Đăng xuất" ghost (form POST giữ nguyên). Trên mobile (<640px): ẩn chữ, giữ icon cho Từ điển/Đăng xuất.
Nội dung `max-w-[1200px] mx-auto px-4 sm:px-6 py-5`.

### 4.2 Thư viện `/`
- Hàng tiêu đề: "Thư viện" 22px trái, `SegmentedControl` "Của tôi | Cộng đồng" phải (link giữ `?tab=`).
- Grid: 1 cột <640px, 2 cột <1000px, 3 cột ≥1000px, gap 20px.
- `LessonCard` (`Card` link): thumbnail 16:9 — có ảnh thì `<img object-cover>`; không có: nền
  `surface-2` với icon `video-off` (draft/processing) hoặc `alert-triangle` màu danger (error). Góc phải
  dưới thumbnail: thời lượng `mm:ss`/`h:mm:ss` từ `duration_sec` (ẩn nếu null). Body: tiêu đề JP 15px/600
  clamp 2 dòng; dòng ngày icon calendar + `lesson_date`; footer: `ProgressRing` 36px + "37/576 câu" (600)
  + nhãn phụ ("đang học · 6%" / "hoàn thành" / "chưa bắt đầu") + `Badge` phải.
- Quy tắc badge: `status !== "ready"` → badge trạng thái tương ứng (ưu tiên hơn tiến độ); `ready` và
  done = total > 0 → `done` "Xong"; `ready` và 0 < done < total → `learning` "Tiếp tục"; còn lại không badge.
- Card `error` thêm hộp `danger-soft` chữ mono 12px hiện `ingest_error`.
- Rỗng: minh hoạ icon `users` trong ô surface-2 + "Chưa có bài học nào." + câu phụ theo tab.

### 4.3 Trang học `/lessons/[id]`
Grid `lg:grid-cols-[minmax(0,1fr)_400px] gap-6`; dưới 1024px xếp 1 cột theo bố cục mobile.

**Cột trái (desktop)**
- Tiêu đề JP 20px/600.
- Video: `rounded-lg overflow-hidden bg-video`; `<video controls playsInline>` giữ nguyên. Không có video:
  placeholder 16:9 nền `video` với icon `video-off` + "Video chưa sẵn sàng" + badge trạng thái. Không đặt bất
  kỳ UI nào đè lên video.
- Dock điều khiển: `Card` ngay dưới video, 2 hàng flex-wrap gap 8px:
  hàng 1: `Button pressed={!!abRange}` icon repeat "Lặp câu" · nhãn "Tốc độ" + `SegmentedControl tight`
  0.5×/0.75×/1×/1.25×/1.5× · `Button` icon eye/eye-off "Ẩn bản dịch"/"Hiện bản dịch";
  hàng 2: `Button` icon check-check "Đã học tới câu đang phát" · `Button primary` icon skip-forward
  "Tiếp tục" · `ProgressRing` + "37/576" (600) + "câu đã học" (muted) · `Button soft pressed={editMode}`
  icon pencil "Sửa" (chỉ owner, đẩy sang phải).
- Dòng hint 12px muted dưới dock: khi lặp: "Đang lặp câu #N · bấm lại để tắt."; khi có câu chưa học:
  "Tiếp tục sẽ nhảy tới câu #M."

**Cột phải (desktop)**
- Panel "Câu" (`Card`): header "Câu · 576" + chip mờ "tự cuộn theo câu đang phát"; danh sách
  `max-h-[560px] overflow-y-auto`. Mỗi cue: grid `[28px 1fr auto]`: `Checkbox` 26px | JP 15.5px + VI 13px
  muted + dòng từ vựng màu accent 12.5px `term（reading） meaning · …` | timestamp `mm:ss` muted 11px.
  Câu đang phát: nền `active-cue`, thanh trái 3px accent (border-left, không đổi cỡ chữ), JP weight 500.
  `uncertain` → icon alert-triangle màu warning trước JP, `title=note`. Edit mode giữ 2 input như hiện tại,
  style `Input` cỡ nhỏ.
- Panel "Từ vựng" (`Card`): header "Từ vựng · 224" + `SegmentedControl` "Câu này · n | Tất cả · 224" +
  `Button ghost` icon eye-off "Ẩn từ thuộc". Mặc định tab **Câu này** (từ của câu đang phát; nếu câu đang phát
  không có từ → hiện "Câu này chưa có từ vựng" + tự chuyển gợi ý sang Tất cả). Lưới `Flashcard` (mục 4.4).
  Edit mode: hàng 3 `Input` 単語 / cách đọc / nghĩa + `Button primary sm` "Thêm vào câu #N"; mỗi flashcard
  có nút ✕ `danger` góc phải trên.

**Mobile (<1024px)**
- Khối ghim `sticky top-0 z-10 bg-bg`: app bar 52px (IconButton chevron-left về `/`, tiêu đề JP 14px 1 dòng
  ellipsis, IconButton pencil nếu owner) → video 16:9 `rounded-md` → hàng `SegmentedControl` "Câu · 37/576 |
  Từ vựng · 224" + `ProgressRing` % (tab Câu) hoặc `Button ghost sm` "Ẩn từ thuộc" (tab Từ vựng).
- Vùng cuộn: tab Câu = danh sách cue (JP 17px, VI 13.5px, Checkbox 28px, auto-scroll `scrollIntoView
  block:"center"`); tab Từ vựng = mục "CÂU ĐANG PHÁT · #N" với `Flashcard size="lg"` full-width, rồi
  "CẢ BÀI · 224" + lưới flashcard.
- Dock đáy `fixed bottom-0` cao 58px + `env(safe-area-inset-bottom)`, 5 nút cột icon 22px + nhãn 11px:
  "Lặp câu" (pressed) · "Tốc độ" (hiện `1×` to; bấm mở popover chọn 5 mức) · "Ẩn dịch"/"Hiện dịch" ·
  "Học tới đây" · "Tiếp tục" (primary). Nội dung có `pb-[72px]` để không bị dock che.
- Segmented tab và dock chỉ đổi state client, không đổi URL.

### 4.4 Flashcard từ vựng (ghép từ hướng "Sổ tay")
Component `Flashcard` props: `term, reading, meaning, known, current, size ("sm"|"lg"), editable,
onToggleKnown, onRemove`.
- Cấu trúc: `<div class="fc" role="group">` chứa nút `front` và `back` xếp chồng (grid-area 1/1),
  `backface-visibility: hidden`, lật bằng `rotateY(180deg)` 320ms; `perspective: 800px`.
- Mặt trước: term JP 15px/500 (lg: 17px) + reading 11px muted (lg: 12px). Mặt sau: reading 12px muted +
  meaning VI 13px text (lg: 14px), nền `surface-2`, không `nowrap` — meaning dài wrap 2 dòng, thẻ
  giữ chiều cao lớn nhất của 2 mặt (grid 1/1 tự làm việc này).
- Trạng thái lật: `hover` hoặc `:focus-within` (desktop, có `@media (hover:hover)`) hoặc class `flipped`
  (mobile, toggle khi chạm mặt trước).
- Đánh dấu đã thuộc: desktop click mặt trước → `onToggleKnown` (không lật thêm). Mobile: mặt sau có
  `Button sm` "✓ Đã thuộc" / "Bỏ đã thuộc". Cả hai đường đều gọi cùng handler `toggleKnown` hiện có.
- `current` (thuộc câu đang phát): viền accent + `inset ring 1px accent`, nền accent-soft.
- `known`: term gạch ngang màu muted, viền đứt, icon check success sau term; vẫn lật được.
- `editable`: nút ✕ 18px tròn `danger` góc phải trên, `stopPropagation`, gọi `onRemove`.
- Bàn phím: mặt trước là `<button>`; Enter/Space = toggle known; focus-within lật để đọc nghĩa.
- `prefers-reduced-motion`: bỏ rotate, đổi bằng opacity.

### 4.5 Từ điển `/dictionary`
- Tiêu đề: "単語帳" (JP, muted, 16px) + "Từ điển" 22px/700 cùng hàng baseline.
- Toolbar desktop: `Input` search icon search max-w-[380px] · `<select>` Tất cả/Chưa thuộc/Đã thuộc styled
  như Input với chevron · `Button` icon download "CSV" · "1000 từ" muted căn phải.
- Desktop (≥768px): bảng trong `Card`, thead nền surface-2 chữ 11.5px uppercase letter-spacing .06em
  muted; cột: `Checkbox` tròn 26px | 単語 JP 16px/500 | Cách đọc JP muted | Nghĩa | ×N (pill surface-2
  tabular) | "mở câu" link accent + icon arrow-up-right. Hàng đã thuộc: term gạch ngang muted; hover nền
  surface-2. Container `overflow-x-auto`.
- Mobile (<768px): toolbar = Input full + hàng `SegmentedControl tight` "Tất cả | Chưa thuộc | Đã thuộc" +
  "1000 từ" + `IconButton download`; danh sách thẻ (`Card` mỏng gap 10px): `[Checkbox tròn 28px]` + term JP 17px
  với reading inline muted 12px / meaning 14px / footer: pill ×N + link "mở câu".
- Logic tìm, lọc, toggle known, CSV giữ nguyên `DictionaryTable`.

### 4.6 Đăng nhập `/login`
Trang nền `bg` với vệt `radial-gradient` accent-soft góc trên trái (opacity thấp). `Card` 400px `rounded-xl`
padding 32px, `shadow`: logo, h1 "Đăng nhập" 22px, câu phụ "Đăng nhập bằng tài khoản được mời." muted,
lỗi "Sai email hoặc mật khẩu." màu danger (giữ điều kiện `?error`), 2 `Input` có icon mail/lock, `Button
primary` full-width 46px "Đăng nhập", footer 12px muted "Học tiếng Nhật từ video họp · 日本語学習版".
`ThemeToggle` góc phải trên trang. Không có link signup.

## 5. Cấu trúc file

```
apps/web/src/
├─ app/
│  ├─ globals.css              token 3 khối + @theme inline + base (font, focus ring, reduced-motion)
│  ├─ layout.tsx               next/font 2 face, đọc cookie theme → data-theme, meta theme-color
│  ├─ login/page.tsx           bố cục mới (actions.ts giữ nguyên)
│  └─ (app)/
│     ├─ layout.tsx            AppHeader
│     ├─ page.tsx              thư viện (query giữ nguyên) → LibraryGrid + LessonCard
│     ├─ lessons/[id]/page.tsx giữ nguyên (chỉ truyền props)
│     └─ dictionary/page.tsx   tiêu đề mới
├─ components/
│  ├─ ui/  Button, IconButton, SegmentedControl, Badge, ProgressRing, Card, Input, Checkbox,
│  │       Flashcard, ThemeToggle, Icon
│  ├─ layout/AppHeader.tsx
│  ├─ library/LessonCard.tsx   (viết lại), EmptyState.tsx
│  ├─ study/StudyView.tsx      (giữ state/handlers; tách JSX thành StudyDesktop + StudyMobile)
│  │        StudyControls.tsx (dock desktop), MobileDock.tsx, CueList.tsx (viết lại), CueItem.tsx,
│  │        VocabPanel.tsx (viết lại dùng Flashcard)
│  └─ dictionary/DictionaryTable.tsx (giữ logic; render bảng/thẻ theo breakpoint bằng CSS `hidden md:block`)
└─ lib/
   ├─ theme.ts                 THEME_COOKIE, parseTheme(), setThemeCookie()
   └─ format.ts                formatDuration(sec), formatTimestamp(ms), percent(done,total)
```

`StudyView` giữ toàn bộ state, effects và mutation Supabase như hiện tại; chỉ chuyển JSX sang các
component con nhận props/callback. Không đổi `lib/player.ts`, `lib/cues.ts`, `lib/video.ts`, `lib/types.ts`.

## 6. Kiểm thử & xác nhận
- Unit (vitest): `lib/format.test.ts` (duration, timestamp, percent); `lib/theme.test.ts` (parseTheme chỉ nhận
  light/dark); `components/ui/Flashcard.test.tsx` (render 2 mặt, class flipped khi chạm ở chế độ mobile, gọi
  onToggleKnown khi click desktop / bấm nút mặt sau) — cần `@testing-library/react` + `jsdom` (thêm devDependency).
- E2E (Playwright `e2e/smoke.spec.ts`): cập nhật selector theo `getByRole`/`aria-label`; thêm bước: bấm
  ThemeToggle → `html[data-theme="dark"]` và cookie `vingo-theme=dark` → reload vẫn dark; đánh dấu từ
  đã thuộc qua flashcard; chạy thêm ở viewport 390×844 mở trang học thấy dock đáy.
- Kiểm tra thị giác thủ công (checklist trong plan): 4 màn hình × 2 theme × (desktop 1280, mobile 390);
  không cuộn ngang; video không bị UI đè; câu JP ≥17px trên mobile; focus ring nhìn thấy khi Tab.
- `pnpm typecheck` và `pnpm test` xanh; `next build` thành công.

## 7. Rủi ro & cách xử lý
- Zen Kaku Gothic New nặng: `preload: false`, 3 weight; fallback Yu Gothic/Hiragino hiển thị trước khi font về
  (chấp nhận đổi vẻ nhẹ). Nếu LCP mobile > 2.5s, giảm còn 2 weight (400/700).
- Cam đất phải giữ đúng mã màu để đạt AA; không "làm tươi" khi triển khai.
- Vùng ghim mobile (app bar + video + tab ≈ 320px) + dock 58px để lại ≈ 430px cho danh sách câu trên máy
  cao 844px; câu dài 4 dòng hiện được ~2 câu. Chấp nhận ở bản này; mini-player để sau.
- Flashcard hover trên thiết bị vừa chuột vừa chạm (laptop touch): dùng `@media (hover:hover)` cho hover-flip,
  còn lại theo cơ chế chạm. Không có trường hợp chạm vô tình đánh dấu đã thuộc vì mobile chỉ đánh dấu qua nút
  mặt sau.
- Server render `data-theme` từ cookie: cookie chỉ ghi khi user bấm toggle, nên người theo hệ không bao giờ có
  attribute → media query quyết định, không nháy.
