#!/usr/bin/env bash
# ============================================================================
#  Vingo — chạy toàn bộ môi trường dev (Git Bash / macOS / Linux).
#  1) đảm bảo Supabase local chạy  2) tạo dev user  3) chạy web (:3000) + mcp (:8787)
#     trong CÙNG 1 terminal — log xen kẽ, Ctrl+C dừng cả hai.
#  ffmpeg đã bundle qua npm (ffmpeg-static) — không cần cài gì thêm.
#
#  Dùng:  bash dev.sh
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

echo "[1/3] Kiểm tra Supabase local..."
if ! supabase status >/dev/null 2>&1; then
  echo "      Supabase chưa chạy — supabase start..."
  supabase start
else
  echo "      Supabase đã chạy."
fi

# Lấy khoá local → export cho mcp (mint user-JWT + service role đúng project).
eval "$(supabase status -o env 2>/dev/null | sed 's/^/export SB_/')"
export SUPABASE_URL="${SB_API_URL:-http://127.0.0.1:55321}"
export SUPABASE_ANON_KEY="${SB_ANON_KEY:-}"
export SUPABASE_SERVICE_ROLE_KEY="${SB_SERVICE_ROLE_KEY:-}"
export SUPABASE_JWT_SECRET="${SB_JWT_SECRET:-}"

echo "[2/3] Tạo dev user cat@vingo.local (idempotent)..."
node scripts/create-dev-user.mjs cat@vingo.local devpass123 || true

echo "[3/3] Chạy web (:3000) + mcp (:8787). Ctrl+C để dừng cả hai."
pids=()
pnpm --filter web dev & pids+=($!)
pnpm --filter mcp dev & pids+=($!)

cleanup() { echo; echo "Dừng..."; kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup INT TERM
wait
