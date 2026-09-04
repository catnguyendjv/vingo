@echo off
rem ============================================================================
rem  Vingo — chay toan bo moi truong dev (Windows, double-click duoc).
rem  1) dam bao Supabase local chay  2) tao dev user  3) mo web (:3000) + mcp (:8787)
rem  ffmpeg da bundle qua npm (ffmpeg-static) — khong can cai gi them.
rem ============================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo [1/3] Kiem tra Supabase local...
supabase status >nul 2>&1
if errorlevel 1 (
  echo       Supabase chua chay - dang khoi dong ^(supabase start^)...
  call supabase start
  if errorlevel 1 (
    echo       [LOI] Khong khoi dong duoc Supabase. Kiem tra Docker Desktop dang chay.
    pause
    exit /b 1
  )
) else (
  echo       Supabase da chay.
)

rem Lay khoa local (mcp dung SUPABASE_*; cac cua so con se ke thua bien nay).
for /f "usebackq tokens=1,* delims==" %%A in (`supabase status -o env`) do (
  if "%%A"=="API_URL"          set "SUPABASE_URL=%%~B"
  if "%%A"=="ANON_KEY"         set "SUPABASE_ANON_KEY=%%~B"
  if "%%A"=="SERVICE_ROLE_KEY" set "SUPABASE_SERVICE_ROLE_KEY=%%~B"
  if "%%A"=="JWT_SECRET"       set "SUPABASE_JWT_SECRET=%%~B"
)

echo.
echo [2/3] Tao dev user cat@vingo.local (idempotent)...
call node scripts\create-dev-user.mjs cat@vingo.local devpass123

echo.
echo [3/3] Mo 2 cua so: web ^(http://localhost:3000^) va mcp ^(http://localhost:8787^)...
start "vingo-web" cmd /k "pnpm --filter web dev"
start "vingo-mcp" cmd /k "pnpm --filter mcp dev"

echo.
echo Xong. Dong tung cua so de dung dich vu tuong ung.
echo   Web:      http://localhost:3000
echo   Settings: http://localhost:3000/settings  (tao ma ghep noi)
echo   MCP:      http://localhost:8787/mcp   (health: /healthz)
echo.
endlocal
