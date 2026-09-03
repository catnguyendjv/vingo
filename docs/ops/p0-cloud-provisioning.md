# Vingo — Cloud provisioning P0 (Task 17)

Checklist thao tác dashboard để đưa Vingo P0 lên cloud (Supabase + Vercel). Không có code mới đi kèm —
đây là task vận hành, cần Cát thao tác trực tiếp trên dashboard. Ghi kết quả (project ref, URL) vào
`docs/superpowers/specs/2026-08-28-vingo-design.md` mục Ops nếu cần.

## Checklist

- [ ] **Bước 1: Tạo Supabase project** — dashboard: region **Tokyo (ap-northeast-1)**, plan Free (P0).
- [ ] **Bước 2: Tắt signup + mời user** — Authentication → Sign In/Up: OFF "Allow new users to sign up";
      KHÔNG bật provider Google. Users → Invite: mời email của Cát (+ đồng nghiệp nếu muốn).
- [ ] **Bước 3: Link + push migrations** — `supabase link --project-ref <ref>` rồi `supabase db push`.
      Xác nhận Database Advisors (security) không cảnh báo nào về bảng/policy vừa tạo.
- [ ] **Bước 4: Secret backup** — GitHub repo → Settings → Secrets: `SUPABASE_DB_URL` (connection string,
      Settings → Database). Chạy tay workflow `db-backup` → artifact có `roles.sql` + `schema.sql` + `data.sql`.
- [ ] **Bước 5: Deploy Vercel** — import repo, root directory `apps/web`, env `NEXT_PUBLIC_SUPABASE_URL` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` (cloud project). Build pass, mở URL → `/login`.
- [ ] **Bước 6: Migrate metadata lên cloud** —
      `SUPABASE_URL=<cloud> SUPABASE_SERVICE_ROLE_KEY=<cloud> pnpm exec tsx scripts/migrate-from-jp-study-kit.mjs --user <uuid user Cát trên cloud>`
      (KHÔNG `--videos` — free tier; bài hiện badge "nháp — chưa có video", đúng thiết kế; video lên cloud
      ở P1 sau khi nâng Pro).
- [ ] **Bước 7: Smoke cloud** — đăng nhập trên điện thoại, thấy 5 bài (badge nháp), mở từ điển thấy từ
      vựng + từ đã thuộc.
- [ ] **Bước 8: Commit** (nếu có thay đổi doc): `git commit -m "chore: record cloud provisioning notes"`.

## Local dev

Supabase local chạy ở port 553xx (khác port mặc định 543xx để tránh đụng project khác trên cùng máy):
API `55321`, DB `55322`, Studio `55323`, Inbucket/Mailpit `55324`.

Lấy key/URL: `supabase status -o env` (in ra `ANON_KEY`, `SERVICE_ROLE_KEY`, `API_URL`, `DB_URL`, ...).

Tạo dev user (idempotent theo email, chạy lại sẽ báo lỗi nếu user đã tồn tại — bỏ qua):

```bash
SUPABASE_URL=<API_URL> SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY> \
  node scripts/create-dev-user.mjs cat@vingo.local devpass123
```

Đăng nhập local: `cat@vingo.local` / `devpass123`.
