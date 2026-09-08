# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dự án

Vingo — web app học ngoại ngữ từ video (Zoom recording / YouTube / upload): video + phụ đề 2 ngôn ngữ sync theo câu, từ vựng, từ điển cá nhân, tiến độ per-user. Người dùng đầu: nội bộ, học tiếng Nhật → Việt, chủ yếu trên điện thoại. Auth invite-only (Supabase), không có signup.

Tài liệu thiết kế là nguồn sự thật khi code và spec lệch nhau:
- `docs/superpowers/specs/2026-08-28-vingo-design.md` — kiến trúc tổng thể, schema, RLS, MCP, phases (P0 → P3).
- `docs/superpowers/specs/2026-09-04-vingo-ui-redesign-design.md` — hệ thống giao diện (token, theme, component, từng màn hình). Mockup thị giác kèm theo trong `specs/assets/`.
- `docs/superpowers/plans/` — plan triển khai theo task; `docs/ops/p0-cloud-provisioning.md` — checklist đưa lên cloud và ghi chú local dev.

Trạng thái: P0 (schema, RLS, web đọc/học, migrate dữ liệu cũ, backup cron, UI redesign), P1 (`apps/mcp` study-kit-mcp chạy localhost + `packages/core` + skill `skills/study-kit` + `/settings` pairing) và P1.5 (SRS `/review`, spec `2026-09-08-vingo-p15-srs-design.md`) code xong. Chưa làm: phase deploy (cloud provisioning Task 17, Supabase Pro, deploy MCP — đã quyết định lùi, không đề xuất lại trừ khi được yêu cầu), P2 (YouTube player, share community, service worker, polish mobile).

## Lệnh

Monorepo pnpm (`apps/web`, `packages/shared`, `e2e`). Node ≥ 22.5. Chạy từ root.

```bash
pnpm -r test                                  # unit: shared + web (vitest)
pnpm --filter web test -- src/lib/format.test.ts   # một file test
pnpm --filter web typecheck                   # tsc --noEmit
pnpm --filter web dev                         # Next.js dev :3000 (turbopack)
pnpm --filter web build                       # KHÔNG chạy khi dev server đang chạy — dùng chung .next, dev sẽ trả 500 tới khi restart
pnpm e2e                                      # Playwright; cần Supabase local + dev server :3000 đang chạy
supabase start / supabase status -o env       # Supabase local; -o env in ANON_KEY, SERVICE_ROLE_KEY, API_URL, DB_URL
supabase db reset                             # áp lại toàn bộ migrations + seed
supabase test db                              # pgTAP trong supabase/tests (RLS, RPC, storage, grants)
```

Supabase local dùng port 553xx (API 55321, DB 55322, Studio 55323, Mailpit 55324) để không đụng project khác trên cùng máy. Web đọc `apps/web/.env` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), file này git-ignore.

Dev user (idempotent theo email): `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/create-dev-user.mjs cat@vingo.local devpass123` — e2e đăng nhập bằng tài khoản này. Nạp 5 bài từ jp-study-kit: `pnpm exec tsx scripts/migrate-from-jp-study-kit.mjs --user <uuid> [--videos]` (uuid v5 từ slug nên chạy lại không tạo trùng).

## Kiến trúc

**Dữ liệu và quyền.** Web app không có API layer riêng: server component gọi Supabase client trực tiếp (`lib/supabase/server.ts`, cookie session qua `@supabase/ssr`; `middleware.ts` refresh session), client component dùng `lib/supabase/client.ts` cho mutation. Toàn bộ phân quyền nằm ở RLS trong `supabase/migrations/0003_rls.sql` — hàm `can_read_lesson(lesson_id)` (owner hoặc bài `community` + `ready`) là gốc cho policy của `cues`, `vocab_items` và storage bucket `videos`. Từ điển đọc qua RPC `my_dictionary()` (gộp `(lang, term)` + đếm số bài). Sửa policy → sửa/thêm pgTAP trong `supabase/tests` và chạy `supabase test db`. Migration đánh số `000N_*.sql`, không chỉnh migration đã áp; `0006_grants.sql` thu hồi execute của `anon/public` trên hàm nhạy cảm.

**Hợp đồng nội dung.** `packages/shared` (`lessonJsonSchema` zod) là hợp đồng ingest dùng chung cho script migrate hôm nay và MCP server ở P1; web import qua `@vingo/shared` (`transpilePackages` trong `next.config.ts`).

**Trang học.** `components/study/StudyView.tsx` giữ toàn bộ state và mutation (tiến độ câu, từ đã thuộc, A–B repeat, tốc độ, edit mode) và một `<video>` duy nhất; các component con (`CueList/CueItem`, `VocabPanel`, `StudyControls`, `MobileDock`) chỉ nhận props. Desktop và mobile là **một cây DOM** phân nhánh bằng `lg:` (sticky video + tab Câu/Từ vựng + dock đáy trên mobile), không render hai cây. Player đi qua interface `PlayerAdapter` (`lib/player.ts`, hiện chỉ HTML5) để P2 cắm YouTube; cue-sync thuần trong `lib/cues.ts` có unit test. Signed URL video/thumbnail cache theo `${userId}:${path}` trong `lib/video.ts` — không bỏ userId khỏi key.

**SRS (P1.5).** `ts-fsrs` 5.x chạy trên client (`lib/srs.ts`, thuần, có unit test; `elapsed_days` không lưu DB mà suy từ `last_review_at`). Ghi DB qua RPC `security invoker` trong `0008_srs.sql`: `enroll_cards`, `review_card` (card + log nguyên tử), `undo_review`, `review_stats`, `review_queue` (đã áp cap 20 thẻ New / 24 giờ trượt, join câu ví dụ qua `review_cards.source_cue_id`). Trigger trên `known_words` đồng bộ `review_cards.suspended` — client không tự sync. `/review` là `components/review/ReviewSession.tsx` giữ state (giống StudyView), `ReviewApi` inject được khi test. Enroll ở 3 chỗ: flashcard (mặt sau), "Ôn tập cả bài" (VocabPanel), cột Ôn tập trong từ điển (`my_dictionary()` có `in_review`). Badge header tính mỗi request trong `(app)/layout.tsx`.

**Giao diện.** Token màu là CSS variables trong `app/globals.css` theo 3 khối (light mặc định → `[data-theme=dark]` → media dark có guard `:not([data-theme="light"])`) và map vào Tailwind v4 qua `@theme inline`: utility `bg-page` (=`--bg`), `text-ink` (=`--text`), `border-line` (=`--border`), còn lại giữ tên (`bg-surface`, `text-muted`, `bg-accent`, `bg-accent-soft`…). Không hard-code màu trong component. Theme lưu cookie `vingo-theme`; `app/layout.tsx` đọc cookie để stamp `data-theme` từ server (không có cookie = theo hệ, không nháy). Font: Be Vietnam Pro (UI) + Zen Kaku Gothic New (tiếng Nhật, `preload: false`); mọi chuỗi tiếng Nhật cần `lang="ja"` + `font-jp`. Component dùng chung trong `components/ui/`; `cn()` chỉ nối chuỗi, không resolve xung đột Tailwind — không truyền `hidden` vào component đã có base display class (bọc bằng span/div thay vào). Flashcard từ vựng: desktop hover/focus lật, click đánh dấu đã thuộc; mobile chạm lật, nút mặt sau đánh dấu.

**Kiểm thử.** Vitest: `.test.ts` thuần + `.test.tsx` (jsdom, testing-library, đặt `// @vitest-environment jsdom` đầu file). Playwright `e2e/smoke.spec.ts` dùng `data-testid` (`theme-toggle`, `cue-item`, `flashcard` + `data-known`, `mobile-dock`, `dict-table`/`dict-list`) và phải idempotent (trả lại trạng thái đã đổi). GitHub Actions `db-backup.yml` dump Postgres hằng đêm (cần secret `SUPABASE_DB_URL`).

## Quy ước

- Commit message tiếng Anh, prefix `feat/fix/test/chore/docs`, mô tả và tài liệu nội bộ viết tiếng Việt.
- Plugin superpowers CHỈ dùng cho phần lên kế hoạch (brainstorm → spec → plan, đặt trong `docs/superpowers/`). Không dùng superpowers để code hay test: sau khi có plan, tự triển khai và chạy test trực tiếp (không subagent-driven-development, không TDD/verification skill của superpowers).
- Không bật Google OAuth và không mở signup (quyết định #11 trong spec gốc).
