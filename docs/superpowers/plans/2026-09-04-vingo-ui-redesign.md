# Vingo UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm lại toàn bộ lớp trình bày của `apps/web` theo hướng "Ấm áp kem đất": token màu light/dark ngang hàng, nút đổi theme lưu cookie, component dùng chung, 4 màn hình mới, từ vựng là flashcard lật mặt.

**Architecture:** Token màu là CSS variables trên `:root` (3 khối: light mặc định, `[data-theme=dark]`, media dark có guard), map vào Tailwind v4 qua `@theme inline`. Server đọc cookie `vingo-theme` để stamp `data-theme` lên `<html>` ngay từ HTML đầu tiên. Component UI nhỏ trong `components/ui/` chỉ dùng token; các màn hình giữ nguyên luồng dữ liệu Supabase, chỉ đổi JSX. `StudyView` giữ toàn bộ state/handlers, tách JSX ra `StudyControls`, `MobileDock`, `CueList/CueItem`, `VocabPanel/Flashcard`; một cây DOM responsive duy nhất (một `<video>` duy nhất).

**Tech Stack:** Next.js 15.5 App Router, React 19.1, Tailwind v4 (`@tailwindcss/postcss`), `next/font/google`, Vitest 2 (+ jsdom, @testing-library/react cho Flashcard), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-04-vingo-ui-redesign-design.md` (mockup thị giác: `docs/superpowers/specs/assets/2026-09-04-vingo-ui-warm-mockup.html`)

## Global Constraints

- Không đổi `lib/player.ts`, `lib/cues.ts`, `lib/video.ts`, `lib/types.ts`, `lib/supabase/*`, `app/login/actions.ts`, `app/(app)/lessons/[id]/page.tsx`, migrations.
- Không thêm thư viện UI/icon runtime. DevDependency được thêm duy nhất: `jsdom`, `@testing-library/react`, `@testing-library/dom`.
- Token màu đúng mã hex trong spec mục 2.1, không "làm tươi". Component không hard-code màu (ngoại lệ: nền video luôn tối, chữ trên đó dùng `#A89684`; overlay thời lượng `bg-black/70 text-white`).
- Tên CSS variable thô = tên trong spec (`--bg`, `--text`, `--border`, …). Tên utility Tailwind: `bg-page` (=`--bg`), `text-ink` (=`--text`), `border-line` (=`--border`), còn lại giữ tên (`bg-surface`, `bg-surface-2`, `text-muted`, `bg-accent`, `text-accent-fg`, `bg-accent-soft`, `bg-active-cue`, `*-success(-soft)`, `*-warning(-soft)`, `*-danger(-soft)`, `bg-video`, `bg-canvas`). Font: `font-sans` (Be Vietnam Pro), `font-jp` (Zen Kaku Gothic New). Bo góc: `rounded-sm` 10px, `rounded-md` 14px, `rounded-lg` 18px, `rounded-xl` 24px, `rounded-full`. Bóng: `shadow-card`, `shadow-sm`.
- Mọi chuỗi tiếng Nhật có `lang="ja"` + `font-jp`. Câu JP ≥17px trên mobile, 15.5px desktop.
- Không đặt UI đè lên `<video>`. Mobile: video sticky, dock 5 nút cố định đáy, nút ≥44px.
- Theme cookie: `vingo-theme=light|dark; Path=/; Max-Age=31536000; SameSite=Lax`. Không cookie = theo hệ (không stamp `data-theme`).
- Flashcard: desktop (`(hover: hover)`) hover/focus lật, click đánh dấu đã thuộc; mobile chạm lật, mặt sau có nút "✓ Đã thuộc". Không long-press.
- Tất cả transition/animation tắt dưới `prefers-reduced-motion: reduce`.
- Lệnh chạy từ root repo: `pnpm --filter web typecheck`, `pnpm --filter web test`, `pnpm --filter web build`, `pnpm e2e` (cần Supabase local + dev server `pnpm --filter web dev` đang chạy ở :3000, user dev `cat@vingo.local` / `devpass123`).
- Commit sau mỗi task, message tiếng Anh, prefix `feat:`/`test:`/`chore:`, kết bằng `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File map

```
apps/web/src/
├─ app/globals.css                      (viết lại) token + @theme inline + base + fc/theme-icon/pop CSS
├─ app/layout.tsx                       (viết lại) next/font 2 face, cookie → data-theme, viewport themeColor
├─ app/login/page.tsx                   (viết lại)
├─ app/(app)/layout.tsx                 (viết lại) dùng AppHeader
├─ app/(app)/page.tsx                   (sửa JSX) SegmentedControl + LessonCard + EmptyState
├─ app/(app)/dictionary/page.tsx        (sửa JSX) tiêu đề
├─ lib/cn.ts                            (mới) nối class
├─ lib/format.ts (+ .test.ts)           (mới) formatDuration, formatTimestamp, percent
├─ lib/theme.ts (+ .test.ts)            (mới) THEME_COOKIE, parseTheme, setThemeCookie, resolveCurrentTheme
├─ lib/lesson-status.ts (+ .test.ts)    (mới) badgeFor, progressLabel
├─ components/ui/Icon.tsx               (mới) 27 icon SVG inline
├─ components/ui/ThemeToggle.tsx        (mới, client)
├─ components/ui/Button.tsx, IconButton.tsx, SegmentedControl.tsx (client), Badge.tsx,
│  ProgressRing.tsx, Card.tsx, Input.tsx, Checkbox.tsx (client), Flashcard.tsx (client, + .test.tsx)
├─ components/layout/AppHeader.tsx      (mới)
├─ components/library/LessonCard.tsx    (viết lại), EmptyState.tsx (mới)
├─ components/study/CueList.tsx         (viết lại, props giữ nguyên), CueItem.tsx (mới),
│  StudyControls.tsx (mới), MobileDock.tsx (mới), VocabPanel.tsx (viết lại), StudyView.tsx (viết lại JSX)
└─ components/dictionary/DictionaryTable.tsx (viết lại JSX, giữ logic)
apps/web/vitest.config.ts               (sửa) include .tsx, jsx automatic
e2e/smoke.spec.ts                       (viết lại)
```

---

### Task 1: Hàm thuần — `cn`, `format`, `theme`, `lesson-status`

**Files:**
- Create: `apps/web/src/lib/cn.ts`
- Create: `apps/web/src/lib/format.ts`, `apps/web/src/lib/format.test.ts`
- Create: `apps/web/src/lib/theme.ts`, `apps/web/src/lib/theme.test.ts`
- Create: `apps/web/src/lib/lesson-status.ts`, `apps/web/src/lib/lesson-status.test.ts`

**Interfaces:**
- Produces: `cn(...parts: Array<string | false | null | undefined>): string`;
  `formatDuration(sec: number | null | undefined): string | null` (`"39:50"`, `"1:12:04"`, null nếu không hợp lệ);
  `formatTimestamp(ms: number): string` (`"0:03"`); `percent(done: number, total: number): number` (0–100, làm tròn);
  `THEME_COOKIE = "vingo-theme"`, `type Theme = "light" | "dark"`, `parseTheme(v): Theme | null`,
  `setThemeCookie(theme)`, `resolveCurrentTheme(): Theme`;
  `type BadgeKind = "learning" | "done" | "draft" | "processing" | "error"`,
  `badgeFor(status, progress): { kind: BadgeKind; label: string } | null`,
  `progressLabel(status, progress): string`.

- [ ] **Step 1: Viết test fail cho format**

`apps/web/src/lib/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatDuration, formatTimestamp, percent } from "./format";

describe("formatDuration", () => {
  it("dưới 1 giờ → m:ss", () => expect(formatDuration(2390)).toBe("39:50"));
  it("trên 1 giờ → h:mm:ss", () => expect(formatDuration(4324)).toBe("1:12:04"));
  it("0 → 0:00", () => expect(formatDuration(0)).toBe("0:00"));
  it("null/âm/NaN → null", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
  });
  it("làm tròn xuống giây lẻ", () => expect(formatDuration(65.9)).toBe("1:05"));
});

describe("formatTimestamp", () => {
  it("ms → m:ss", () => expect(formatTimestamp(3000)).toBe("0:03"));
  it("ms lớn → h:mm:ss", () => expect(formatTimestamp(3_723_000)).toBe("1:02:03"));
});

describe("percent", () => {
  it("total 0 → 0", () => expect(percent(5, 0)).toBe(0));
  it("làm tròn", () => expect(percent(37, 576)).toBe(6));
  it("không vượt 100", () => expect(percent(200, 100)).toBe(100));
  it("đủ → 100", () => expect(percent(140, 140)).toBe(100));
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter web test -- src/lib/format.test.ts`
Expected: FAIL — `Failed to resolve import "./format"`.

- [ ] **Step 3: Implement `cn.ts` và `format.ts`**

`apps/web/src/lib/cn.ts`:
```ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
```

`apps/web/src/lib/format.ts`:
```ts
export function formatDuration(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return null;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

export function formatTimestamp(ms: number): string {
  return formatDuration(ms / 1000) ?? "0:00";
}

export function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm --filter web test -- src/lib/format.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Viết test fail cho theme**

`apps/web/src/lib/theme.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { THEME_COOKIE, parseTheme } from "./theme";

describe("theme", () => {
  it("tên cookie cố định", () => expect(THEME_COOKIE).toBe("vingo-theme"));
  it("chỉ nhận light/dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("auto")).toBeNull();
    expect(parseTheme("")).toBeNull();
    expect(parseTheme(undefined)).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });
});
```

- [ ] **Step 6: Implement `theme.ts`**

`apps/web/src/lib/theme.ts`:
```ts
export const THEME_COOKIE = "vingo-theme";
export type Theme = "light" | "dark";

export function parseTheme(v: string | undefined | null): Theme | null {
  return v === "light" || v === "dark" ? v : null;
}

/** Chỉ gọi phía client. Không đặt cookie khi user theo hệ (không có lựa chọn). */
export function setThemeCookie(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Theme đang hiệu lực: data-theme nếu có, không thì theo hệ. Chỉ gọi phía client. */
export function resolveCurrentTheme(): Theme {
  const stamped = parseTheme(document.documentElement.dataset.theme);
  if (stamped) return stamped;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
```

- [ ] **Step 7: Viết test fail cho lesson-status**

`apps/web/src/lib/lesson-status.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { badgeFor, progressLabel } from "./lesson-status";

describe("badgeFor", () => {
  it("draft/processing/error ưu tiên hơn tiến độ", () => {
    expect(badgeFor("draft", { done: 5, total: 10 })).toEqual({ kind: "draft", label: "nháp — chưa có video" });
    expect(badgeFor("processing", { done: 0, total: 0 })).toEqual({ kind: "processing", label: "đang xử lý video…" });
    expect(badgeFor("error", { done: 10, total: 10 })).toEqual({ kind: "error", label: "lỗi xử lý video" });
  });
  it("ready + học hết → Xong", () => expect(badgeFor("ready", { done: 140, total: 140 })).toEqual({ kind: "done", label: "Xong" }));
  it("ready + đang học → Tiếp tục", () => expect(badgeFor("ready", { done: 37, total: 576 })).toEqual({ kind: "learning", label: "Tiếp tục" }));
  it("ready + chưa học → không badge", () => expect(badgeFor("ready", { done: 0, total: 140 })).toBeNull());
  it("ready + không có câu → không badge", () => expect(badgeFor("ready", { done: 0, total: 0 })).toBeNull());
});

describe("progressLabel", () => {
  it("chưa sẵn sàng", () => expect(progressLabel("draft", { done: 0, total: 140 })).toBe("chưa sẵn sàng"));
  it("chưa bắt đầu", () => expect(progressLabel("ready", { done: 0, total: 140 })).toBe("chưa bắt đầu"));
  it("đang học kèm %", () => expect(progressLabel("ready", { done: 37, total: 576 })).toBe("đang học · 6%"));
  it("hoàn thành", () => expect(progressLabel("ready", { done: 140, total: 140 })).toBe("hoàn thành"));
  it("không có câu", () => expect(progressLabel("ready", { done: 0, total: 0 })).toBe("chưa có câu"));
});
```

- [ ] **Step 8: Implement `lesson-status.ts`**

`apps/web/src/lib/lesson-status.ts`:
```ts
import type { LessonRow } from "./types";
import { percent } from "./format";

export type BadgeKind = "learning" | "done" | "draft" | "processing" | "error";
export type Progress = { done: number; total: number };

export function badgeFor(status: LessonRow["status"], p: Progress): { kind: BadgeKind; label: string } | null {
  if (status === "draft") return { kind: "draft", label: "nháp — chưa có video" };
  if (status === "processing") return { kind: "processing", label: "đang xử lý video…" };
  if (status === "error") return { kind: "error", label: "lỗi xử lý video" };
  if (p.total > 0 && p.done >= p.total) return { kind: "done", label: "Xong" };
  if (p.done > 0) return { kind: "learning", label: "Tiếp tục" };
  return null;
}

export function progressLabel(status: LessonRow["status"], p: Progress): string {
  if (status !== "ready") return "chưa sẵn sàng";
  if (p.total === 0) return "chưa có câu";
  if (p.done === 0) return "chưa bắt đầu";
  if (p.done >= p.total) return "hoàn thành";
  return `đang học · ${percent(p.done, p.total)}%`;
}
```

- [ ] **Step 9: Chạy toàn bộ test web + typecheck**

Run: `pnpm --filter web test && pnpm --filter web typecheck`
Expected: PASS toàn bộ (cues + format + theme + lesson-status), typecheck không lỗi.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/cn.ts apps/web/src/lib/format.ts apps/web/src/lib/format.test.ts apps/web/src/lib/theme.ts apps/web/src/lib/theme.test.ts apps/web/src/lib/lesson-status.ts apps/web/src/lib/lesson-status.test.ts
git commit -m "feat(web): pure helpers for formatting, theme cookie and lesson status badges

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Token màu, font, theme SSR, `Icon`, `ThemeToggle`

**Files:**
- Modify: `apps/web/src/app/globals.css` (viết lại toàn bộ)
- Modify: `apps/web/src/app/layout.tsx` (viết lại toàn bộ)
- Create: `apps/web/src/components/ui/Icon.tsx`
- Create: `apps/web/src/components/ui/ThemeToggle.tsx`

**Interfaces:**
- Consumes: `THEME_COOKIE`, `parseTheme`, `setThemeCookie`, `resolveCurrentTheme` (Task 1).
- Produces: utility Tailwind theo Global Constraints; `IconName` union và `Icon({ name, className, strokeWidth?, ...svgProps })` (caller LUÔN truyền class kích cỡ, vd `size-[18px]`); `ThemeToggle({ className? })` có `data-testid="theme-toggle"`, `aria-label="Đổi giao diện sáng/tối"`; class CSS toàn cục `.theme-icon-sun/.theme-icon-moon`, `.fc/.fc-front/.fc-back/.fc-flipped/.fc-actions`, `.animate-pop`.

- [ ] **Step 1: Viết lại `globals.css`**

```css
@import "tailwindcss";

/* ===== Token thô (tên theo spec 2.1). 1) light mặc định ===== */
:root {
  --canvas: #F1EAE0;
  --bg: #FAF6F0;
  --surface: #FFFFFF;
  --surface-2: #F3ECE3;
  --text: #2B2118;
  --muted: #7A6A5C;
  --border: #EADFD3;
  --accent: #B84A22;
  --accent-fg: #FFFFFF;
  --accent-soft: #FBE7DC;
  --active-cue: #FFF1E6;
  --success: #18806A;
  --success-soft: #DDF1EA;
  --warning: #955F12;
  --warning-soft: #FBEFD6;
  --danger: #B3412F;
  --danger-soft: #FADDD7;
  --video: #1A120D;
  --elev-1: 0 1px 2px rgba(60, 40, 20, .05), 0 10px 28px -14px rgba(60, 40, 20, .22);
  --elev-0: 0 1px 2px rgba(60, 40, 20, .08);
  --ff-body: var(--font-be-vietnam), var(--font-zen-kaku), system-ui, -apple-system, "Segoe UI", sans-serif;
  --ff-jp: var(--font-zen-kaku), "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif;
  color-scheme: light;
}

/* 2) người dùng chọn dark */
:root[data-theme="dark"] {
  --canvas: #141110; --bg: #1C1714; --surface: #26201C; --surface-2: #2F2721;
  --text: #F3EAE1; --muted: #A89684; --border: #3A312B;
  --accent: #E8825A; --accent-fg: #1C1714; --accent-soft: #3D2A20; --active-cue: #3B2A21;
  --success: #4CC0A0; --success-soft: #1F3A33; --warning: #E0A84A; --warning-soft: #3B2F1C;
  --danger: #E8735F; --danger-soft: #43241F; --video: #0F0B09;
  --elev-1: 0 1px 2px rgba(0, 0, 0, .3), 0 12px 30px -14px rgba(0, 0, 0, .6);
  --elev-0: 0 1px 2px rgba(0, 0, 0, .35);
  color-scheme: dark;
}

/* 3) theo hệ (không stamp) — guard để chọn light thắng hệ dark */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --canvas: #141110; --bg: #1C1714; --surface: #26201C; --surface-2: #2F2721;
    --text: #F3EAE1; --muted: #A89684; --border: #3A312B;
    --accent: #E8825A; --accent-fg: #1C1714; --accent-soft: #3D2A20; --active-cue: #3B2A21;
    --success: #4CC0A0; --success-soft: #1F3A33; --warning: #E0A84A; --warning-soft: #3B2F1C;
    --danger: #E8735F; --danger-soft: #43241F; --video: #0F0B09;
    --elev-1: 0 1px 2px rgba(0, 0, 0, .3), 0 12px 30px -14px rgba(0, 0, 0, .6);
    --elev-0: 0 1px 2px rgba(0, 0, 0, .35);
    color-scheme: dark;
  }
}

/* ===== Map vào Tailwind v4 ===== */
@theme inline {
  --color-canvas: var(--canvas);
  --color-page: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-ink: var(--text);
  --color-muted: var(--muted);
  --color-line: var(--border);
  --color-accent: var(--accent);
  --color-accent-fg: var(--accent-fg);
  --color-accent-soft: var(--accent-soft);
  --color-active-cue: var(--active-cue);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-video: var(--video);
  --font-sans: var(--ff-body);
  --font-jp: var(--ff-jp);
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-xl: 24px;
  --shadow-card: var(--elev-1);
  --shadow-sm: var(--elev-0);
  --ease-soft: cubic-bezier(.2, .8, .2, 1);
}

/* ===== Base ===== */
html, body { margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--ff-body);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  transition: background-color .25s, color .25s;
}
[lang="ja"], .font-jp { font-feature-settings: "palt" 1; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }

/* ===== ThemeToggle: icon theo theme đang hiệu lực (kể cả khi theo hệ) ===== */
.theme-icon-moon { display: none; }
:root[data-theme="dark"] .theme-icon-sun { display: none; }
:root[data-theme="dark"] .theme-icon-moon { display: block; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .theme-icon-sun { display: none; }
  :root:not([data-theme="light"]) .theme-icon-moon { display: block; }
}

/* ===== Checkbox pop ===== */
@keyframes pop { 0% { transform: scale(.82); } 60% { transform: scale(1.14); } 100% { transform: scale(1); } }
.animate-pop { animation: pop .35s cubic-bezier(.2, .8, .2, 1); }

/* ===== Flashcard lật mặt ===== */
.fc { perspective: 800px; }
.fc-front, .fc-back {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transition: transform .32s cubic-bezier(.2, .8, .2, 1), border-color .15s, background-color .15s;
}
.fc-back { transform: rotateY(180deg); }
.fc-flipped .fc-front, .fc:focus-within .fc-front { transform: rotateY(180deg); }
.fc-flipped .fc-back, .fc:focus-within .fc-back { transform: rotateY(0); }
@media (hover: hover) {
  .fc:hover .fc-front { transform: rotateY(180deg); }
  .fc:hover .fc-back { transform: rotateY(0); }
  .fc-actions { display: none; }          /* desktop: click thẻ = đánh dấu, không cần nút mặt sau */
}

/* ===== Reduced motion ===== */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; scroll-behavior: auto !important; }
  .fc-front, .fc-back { transition: none; }
  .fc-flipped .fc-front, .fc:focus-within .fc-front, .fc:hover .fc-front { transform: none; opacity: 0; }
  .fc-back { transform: none; opacity: 0; }
  .fc-flipped .fc-back, .fc:focus-within .fc-back, .fc:hover .fc-back { opacity: 1; }
}
```

- [ ] **Step 2: Viết lại `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Zen_Kaku_Gothic_New } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

// Font JP nặng: không preload, trình duyệt tải khi gặp glyph (spec 2.2).
const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  variable: "--font-zen-kaku",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Vingo",
  description: "Học ngoại ngữ từ video",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6F0" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1714" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="vi" data-theme={theme ?? undefined} className={`${beVietnam.variable} ${zenKaku.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Viết `components/ui/Icon.tsx`**

```tsx
import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

const PATHS = {
  play: <path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none" />,
  book: <><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  "log-out": <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></>,
  calendar: <><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>,
  "video-off": <><path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" /><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" /><path d="m2 2 20 20" /></>,
  "alert-triangle": <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  "check-check": <><path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" /></>,
  repeat: <><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>,
  gauge: <><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></>,
  eye: <><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" /></>,
  "skip-forward": <><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" x2="19" y1="5" y2="19" /></>,
  pencil: <><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></>,
  "arrow-up-right": <><path d="M7 7h10v10" /><path d="M7 17 17 7" /></>,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  flip: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></>,
  mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  lock: <><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name, className, strokeWidth = 1.9, ...rest
}: Omit<SVGProps<SVGSVGElement>, "name"> & { name: IconName; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={cn("shrink-0", className)} {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
```

- [ ] **Step 4: Viết `components/ui/ThemeToggle.tsx`**

```tsx
"use client";
import { cn } from "@/lib/cn";
import { resolveCurrentTheme, setThemeCookie } from "@/lib/theme";
import { Icon } from "./Icon";

export function ThemeToggle({ className }: { className?: string }) {
  const toggle = () => {
    const next = resolveCurrentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setThemeCookie(next);
  };
  return (
    <button
      type="button" onClick={toggle} data-testid="theme-toggle"
      aria-label="Đổi giao diện sáng/tối" title="Đổi giao diện sáng/tối"
      className={cn("grid size-[38px] place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink", className)}
    >
      <Icon name="sun" className="theme-icon-sun size-[18px]" />
      <Icon name="moon" className="theme-icon-moon size-[18px]" />
    </button>
  );
}
```

- [ ] **Step 5: Typecheck + chạy dev server kiểm tra token**

Run: `pnpm --filter web typecheck`
Expected: không lỗi.

Với dev server đang chạy ở :3000, mở http://localhost:3000/login → chữ đã đổi sang Be Vietnam Pro (kiểm tra bằng DevTools computed font-family), nền theo hệ. Trong console chạy:
```js
document.documentElement.dataset.theme = "light"; getComputedStyle(document.body).backgroundColor
```
Expected: `rgb(250, 246, 240)`; đổi sang `"dark"` → `rgb(28, 23, 20)`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/layout.tsx apps/web/src/components/ui/Icon.tsx apps/web/src/components/ui/ThemeToggle.tsx
git commit -m "feat(web): warm design tokens, Be Vietnam Pro + Zen Kaku fonts, cookie-backed theme, inline icon set

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Component UI dùng chung

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx`, `IconButton.tsx`, `SegmentedControl.tsx`, `Badge.tsx`, `ProgressRing.tsx`, `Card.tsx`, `Input.tsx`, `Checkbox.tsx`

**Interfaces:**
- Consumes: `cn`, `Icon`, `IconName`, `BadgeKind` (Task 1–2).
- Produces:
  - `Button({ variant?: "default"|"primary"|"soft"|"ghost", size?: "md"|"sm", pressed?: boolean, ...button })` — `pressed` đặt `aria-pressed` và thay look bằng accent-soft.
  - `IconButton({ label: string, ...button })` — 38px tròn, `aria-label=label`.
  - `SegmentedControl<T extends string>({ items: { value: T; label: ReactNode; href?: string }[], value: T, onChange?: (v: T) => void, tight?: boolean, ariaLabel: string, className? })` — item có `href` render `<Link>`, không thì `<button>`; `role="tablist"/"tab"`, `aria-selected`.
  - `Badge({ kind: BadgeKind, children, className? })`.
  - `ProgressRing({ value: number (0–100), size?: number = 36, label?: boolean, className? })`.
  - `Card({ className?, children })` + `export const cardClass = "rounded-lg border border-line bg-surface"`.
  - `Input({ icon?: IconName, className?, ...input })` — wrapper `<label class="relative block">`, input `h-11`.
  - `Checkbox({ checked, onChange, label, size?: "md"|"lg", round?: boolean, className? })` — `<button role="checkbox" aria-checked>`; `stopPropagation` trong onClick; pop khi tick.

- [ ] **Step 1: Viết `Button.tsx`**

```tsx
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "default" | "primary" | "soft" | "ghost";

const VARIANT: Record<ButtonVariant, string> = {
  default: "border-line bg-surface text-ink hover:border-muted hover:bg-surface-2",
  primary: "border-accent bg-accent text-accent-fg font-semibold shadow-[0_6px_16px_-8px_var(--accent)] hover:brightness-105",
  soft: "border-transparent bg-surface-2 text-ink hover:border-muted",
  ghost: "border-transparent bg-transparent text-muted hover:bg-surface-2 hover:text-ink",
};

export function Button({
  variant = "default", size = "md", pressed, className, children, type = "button", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "md" | "sm"; pressed?: boolean }) {
  const look = pressed ? "border-accent bg-accent-soft text-accent" : VARIANT[variant];
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border font-medium leading-none transition-[background-color,border-color,transform,box-shadow] duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "min-h-[34px] px-3 text-[13px]" : "min-h-[40px] px-4 text-sm",
        look, className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Viết `IconButton.tsx`**

```tsx
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function IconButton({
  label, className, children, type = "button", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type} aria-label={label} title={label}
      className={cn("grid size-[38px] shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Viết `SegmentedControl.tsx`** (client vì có onClick)

```tsx
"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SegmentedItem<T extends string> = { value: T; label: ReactNode; href?: string };

export function SegmentedControl<T extends string>({
  items, value, onChange, tight, ariaLabel, className,
}: {
  items: SegmentedItem<T>[]; value: T; onChange?: (v: T) => void;
  tight?: boolean; ariaLabel: string; className?: string;
}) {
  const pad = tight ? "px-[11px] py-1.5 text-[13px]" : "px-4 py-[7px] text-sm";
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("inline-flex gap-0.5 rounded-full bg-surface-2 p-1", className)}>
      {items.map((it) => {
        const on = it.value === value;
        const cls = cn(
          "whitespace-nowrap rounded-full font-medium transition-colors", pad,
          on ? "bg-surface font-semibold text-ink shadow-sm" : "text-muted hover:text-ink",
        );
        return it.href ? (
          <Link key={it.value} href={it.href} role="tab" aria-selected={on} className={cls}>{it.label}</Link>
        ) : (
          <button key={it.value} type="button" role="tab" aria-selected={on} className={cls} onClick={() => onChange?.(it.value)}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Viết `Badge.tsx`, `ProgressRing.tsx`, `Card.tsx`**

`Badge.tsx`:
```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BadgeKind } from "@/lib/lesson-status";

const KIND: Record<BadgeKind, string> = {
  learning: "bg-accent-soft text-accent",
  done: "bg-success-soft text-success",
  draft: "bg-surface-2 text-muted",
  processing: "bg-warning-soft text-warning",
  error: "bg-danger-soft text-danger",
};

export function Badge({ kind, children, className }: { kind: BadgeKind; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-tight", KIND[kind], className)}>
      {children}
    </span>
  );
}
```

`ProgressRing.tsx`:
```tsx
import { cn } from "@/lib/cn";

export function ProgressRing({ value, size = 36, label, className }: { value: number; size?: number; label?: boolean; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const done = v >= 100;
  return (
    <span role="img" aria-label={`${v}%`} className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="size-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.4" className="stroke-line" />
        <circle
          cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.4" strokeLinecap="round"
          pathLength={100} strokeDasharray={`${v} 100`}
          className={cn("transition-[stroke-dasharray] duration-500", done ? "stroke-success" : "stroke-accent")}
        />
      </svg>
      {label && <span className="absolute text-[10px] font-bold tabular-nums">{v}%</span>}
    </span>
  );
}
```

`Card.tsx`:
```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const cardClass = "rounded-lg border border-line bg-surface";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(cardClass, className)}>{children}</div>;
}
```

- [ ] **Step 5: Viết `Input.tsx` và `Checkbox.tsx`**

`Input.tsx`:
```tsx
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

export function Input({ icon, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon?: IconName }) {
  return (
    <label className={cn("relative block", className)}>
      {icon && <Icon name={icon} className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-muted" />}
      <input
        className={cn(
          "h-11 w-full rounded-md border border-line bg-surface text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]",
          icon ? "pl-10 pr-3.5" : "px-3.5",
        )}
        {...rest}
      />
    </label>
  );
}
```

`Checkbox.tsx`:
```tsx
"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export function Checkbox({
  checked, onChange, label, size = "md", round, className,
}: { checked: boolean; onChange: () => void; label: string; size?: "md" | "lg"; round?: boolean; className?: string }) {
  const [pop, setPop] = useState(false);
  return (
    <button
      type="button" role="checkbox" aria-checked={checked} aria-label={label}
      onClick={(e) => { e.stopPropagation(); if (!checked) setPop(true); onChange(); }}
      onAnimationEnd={() => setPop(false)}
      className={cn(
        "grid shrink-0 place-items-center border transition-colors",
        size === "lg" ? "size-7" : "size-[26px]",
        round ? "rounded-full" : "rounded-[9px]",
        checked ? "border-success bg-success text-white" : "border-line bg-surface hover:border-muted",
        pop && "animate-pop", className,
      )}
    >
      {checked && <Icon name="check" className="size-4" strokeWidth={3} />}
    </button>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: không lỗi (component chưa được dùng nhưng phải compile).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ui
git commit -m "feat(web): shared UI primitives (button, segmented, badge, ring, card, input, checkbox)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `Flashcard` + hạ tầng test component (jsdom, testing-library)

**Files:**
- Modify: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json` (devDependencies qua pnpm)
- Create: `apps/web/src/components/ui/Flashcard.tsx`, `apps/web/src/components/ui/Flashcard.test.tsx`

**Interfaces:**
- Produces: `Flashcard({ term, reading: string|null, meaning: string|null, known: boolean, current?: boolean, size?: "sm"|"lg", editable?: boolean, onToggleKnown: () => void, onRemove?: () => void })`. Root `div.fc` có `data-testid="flashcard"`, `data-known="true|false"`, class `fc-flipped` khi đang lật ở chế độ chạm. Mặt trước là `<button>` (aria-label "<term>: đánh dấu đã thuộc" / "…: bỏ đánh dấu đã thuộc"). Mặt sau có nút "✓ Đã thuộc"/"Bỏ đã thuộc" và "Đóng" (ẩn trên desktop qua CSS `.fc-actions`).
- Hành vi: click vào thẻ → nếu `matchMedia("(hover: hover)").matches` thì `onToggleKnown()`, không thì toggle `fc-flipped`. Nút mặt sau `stopPropagation`, gọi `onToggleKnown()` rồi đóng.

- [ ] **Step 1: Thêm devDependencies + sửa vitest config**

Run: `pnpm --filter web add -D jsdom @testing-library/react @testing-library/dom`

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { include: ["src/**/*.test.{ts,tsx}"], passWithNoTests: true },
  esbuild: { jsx: "automatic" },
  css: { postcss: { plugins: [] } },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 2: Viết test fail**

`apps/web/src/components/ui/Flashcard.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Flashcard } from "./Flashcard";

function mockHover(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

const base = { term: "採用状況", reading: "さいようじょうきょう", meaning: "tình hình tuyển dụng", known: false };

afterEach(cleanup);

describe("Flashcard", () => {
  it("hiện term, cách đọc và nghĩa", () => {
    mockHover(true);
    render(<Flashcard {...base} onToggleKnown={() => {}} />);
    expect(screen.getByText("採用状況")).toBeTruthy();
    expect(screen.getAllByText("さいようじょうきょう").length).toBeGreaterThan(0);
    expect(screen.getByText("tình hình tuyển dụng")).toBeTruthy();
    expect(screen.getByTestId("flashcard").getAttribute("data-known")).toBe("false");
  });

  describe("desktop (hover: hover)", () => {
    beforeEach(() => mockHover(true));
    it("click thẻ → onToggleKnown, không lật", () => {
      const spy = vi.fn();
      render(<Flashcard {...base} onToggleKnown={spy} />);
      fireEvent.click(screen.getByRole("button", { name: "採用状況: đánh dấu đã thuộc" }));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("flashcard").classList.contains("fc-flipped")).toBe(false);
    });
  });

  describe("mobile (hover: none)", () => {
    beforeEach(() => mockHover(false));
    it("chạm thẻ → lật, không đánh dấu; nút mặt sau → đánh dấu rồi đóng", () => {
      const spy = vi.fn();
      render(<Flashcard {...base} onToggleKnown={spy} />);
      const card = screen.getByTestId("flashcard");
      fireEvent.click(screen.getByRole("button", { name: "採用状況: đánh dấu đã thuộc" }));
      expect(card.classList.contains("fc-flipped")).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "✓ Đã thuộc" }));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(card.classList.contains("fc-flipped")).toBe(false);
    });
  });

  it("known → gạch ngang, aria-label đổi, data-known=true", () => {
    mockHover(true);
    render(<Flashcard {...base} known onToggleKnown={() => {}} />);
    expect(screen.getByRole("button", { name: "採用状況: bỏ đánh dấu đã thuộc" })).toBeTruthy();
    expect(screen.getByTestId("flashcard").getAttribute("data-known")).toBe("true");
    expect(screen.getByText("採用状況").className).toContain("line-through");
  });

  it("editable → nút xoá gọi onRemove, không gọi onToggleKnown", () => {
    mockHover(true);
    const toggle = vi.fn(); const remove = vi.fn();
    render(<Flashcard {...base} editable onToggleKnown={toggle} onRemove={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "Xoá từ 採用状況" }));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(toggle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm --filter web test -- src/components/ui/Flashcard.test.tsx`
Expected: FAIL — `Failed to resolve import "./Flashcard"`.

- [ ] **Step 4: Viết `Flashcard.tsx`**

```tsx
"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type FlashcardProps = {
  term: string; reading: string | null; meaning: string | null;
  known: boolean; current?: boolean; size?: "sm" | "lg"; editable?: boolean;
  onToggleKnown: () => void; onRemove?: () => void;
};

function hoverCapable(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
}

export function Flashcard({ term, reading, meaning, known, current, size = "sm", editable, onToggleKnown, onRemove }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);
  const lg = size === "lg";
  const face = cn(
    "col-start-1 row-start-1 flex flex-col justify-center rounded-md border text-left",
    lg ? "px-4 py-3" : "px-3 py-2",
  );
  const readingCls = cn("font-jp leading-tight text-muted", lg ? "text-xs" : "text-[11px]");

  const handleCardClick = () => {
    if (hoverCapable()) onToggleKnown();
    else setFlipped((f) => !f);
  };

  return (
    <div
      data-testid="flashcard" data-known={known ? "true" : "false"}
      className={cn("fc relative inline-grid", lg && "w-full", flipped && "fc-flipped")}
      onClick={handleCardClick}
    >
      <button
        type="button"
        aria-label={`${term}: ${known ? "bỏ đánh dấu đã thuộc" : "đánh dấu đã thuộc"}`}
        className={cn(
          face, "fc-front",
          current ? "border-accent bg-accent-soft ring-1 ring-inset ring-accent" : "border-line bg-surface hover:border-muted",
          known && "border-dashed",
        )}
      >
        <span lang="ja" className={cn("flex items-center gap-1.5 font-jp font-medium leading-tight", lg ? "text-[17px]" : "text-[15px]", known && "line-through text-muted decoration-muted")}>
          {term}
          {known && <Icon name="check" className="size-3.5 text-success" strokeWidth={3} />}
        </span>
        {reading && <span lang="ja" className={readingCls}>{reading}</span>}
      </button>

      <div className={cn(face, "fc-back border-line bg-surface-2")} aria-hidden={!flipped}>
        {reading && <span lang="ja" className={readingCls}>{reading}</span>}
        <span className={cn("leading-snug text-ink", lg ? "text-sm" : "text-[13px]")}>{meaning ?? "—"}</span>
        <span className="fc-actions mt-1.5 flex gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleKnown(); setFlipped(false); }}
            className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium hover:border-muted"
          >
            {known ? "Bỏ đã thuộc" : "✓ Đã thuộc"}
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setFlipped(false); }} className="rounded-full px-2 py-0.5 text-[11px] text-muted">
            Đóng
          </button>
        </span>
      </div>

      {editable && onRemove && (
        <button
          type="button" aria-label={`Xoá từ ${term}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -right-1.5 -top-1.5 z-10 grid size-[18px] place-items-center rounded-full bg-danger text-white"
        >
          <Icon name="x" className="size-3" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
```

Ghi chú: `aria-hidden={!flipped}` trên mặt sau — ở desktop mặt sau hiện qua hover nhưng vẫn aria-hidden; nội dung nghĩa đã có trong `title`? Không: để screen reader đọc được nghĩa, `aria-hidden` chỉ áp khi KHÔNG lật và KHÔNG focus. Chấp nhận: bàn phím focus vào mặt trước sẽ lật (CSS `:focus-within`), khi đó `flipped` state vẫn false → giữ `aria-hidden={!flipped}` là đủ vì screen reader đọc `aria-label` của mặt trước (có term); nghĩa được đọc khi user chạm/click lật. Không đổi.

- [ ] **Step 5: Chạy test, xác nhận pass; typecheck**

Run: `pnpm --filter web test && pnpm --filter web typecheck`
Expected: PASS (5 test Flashcard + các test cũ), typecheck không lỗi.

- [ ] **Step 6: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/package.json pnpm-lock.yaml apps/web/src/components/ui/Flashcard.tsx apps/web/src/components/ui/Flashcard.test.tsx
git commit -m "feat(web): flip flashcard component with jsdom component tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `AppHeader`, layout `(app)`, trang đăng nhập

**Files:**
- Create: `apps/web/src/components/layout/AppHeader.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx` (viết lại)
- Modify: `apps/web/src/app/login/page.tsx` (viết lại)

**Interfaces:**
- Consumes: `Icon`, `ThemeToggle`, `Input`, `Button`.
- Produces: `AppHeader()` server component; layout `(app)` bọc nội dung `mx-auto max-w-[1200px] px-4 py-5 sm:px-6`.

- [ ] **Step 1: Viết `AppHeader.tsx`**

```tsx
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AppHeader() {
  return (
    <header className="border-b border-line bg-page">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.02em]">
          <span className="grid size-[30px] place-items-center rounded-sm bg-accent text-accent-fg">
            <Icon name="play" className="size-4" />
          </span>
          Vingo
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link
            href="/dictionary"
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 font-medium transition-colors hover:bg-surface-2"
          >
            <Icon name="book" className="size-[18px]" />
            <span className="hidden sm:inline">
              <span lang="ja" className="font-jp text-muted">単語帳</span> Từ điển
            </span>
          </Link>
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Icon name="log-out" className="size-[18px]" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Viết lại `(app)/layout.tsx`**

```tsx
import { AppHeader } from "@/components/layout/AppHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-ink">
      <AppHeader />
      <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Viết lại `login/page.tsx`**

```tsx
import { login } from "./actions";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-page p-6 text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_10%_0%,var(--accent-soft),transparent_70%)] opacity-70"
      />
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="relative flex w-full max-w-[400px] flex-col gap-5 rounded-xl border border-line bg-surface p-8 shadow-card">
        <div className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.02em]">
          <span className="grid size-[30px] place-items-center rounded-sm bg-accent text-accent-fg">
            <Icon name="play" className="size-4" />
          </span>
          Vingo
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Đăng nhập</h1>
          <p className="mt-1 text-sm text-muted">Đăng nhập bằng tài khoản được mời.</p>
          {error && <p className="mt-2 text-sm font-medium text-danger">Sai email hoặc mật khẩu.</p>}
        </div>
        <form action={login} className="flex flex-col gap-3">
          <Input name="email" type="email" required placeholder="Email" autoComplete="email" icon="mail" />
          <Input name="password" type="password" required placeholder="Mật khẩu" autoComplete="current-password" icon="lock" />
          <Button type="submit" variant="primary" className="mt-1 h-[46px] w-full justify-center">Đăng nhập</Button>
        </form>
        <p className="text-center text-xs text-muted">
          Học tiếng Nhật từ video họp · <span lang="ja" className="font-jp">日本語学習版</span>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + kiểm tra thủ công**

Run: `pnpm --filter web typecheck`
Expected: không lỗi.

Mở http://localhost:3000/login: card kem/trắng, 2 input có icon, nút cam. Bấm nút theme góc phải trên → nền đổi ngay, reload vẫn giữ (cookie). Đăng nhập `cat@vingo.local` / `devpass123` → header mới với logo cam, link Từ điển, toggle, Đăng xuất. Thu hẹp cửa sổ <640px: chỉ còn icon.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/AppHeader.tsx "apps/web/src/app/(app)/layout.tsx" apps/web/src/app/login/page.tsx
git commit -m "feat(web): new app header with theme toggle and redesigned login page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Thư viện — `LessonCard`, `EmptyState`, trang `/`

**Files:**
- Modify: `apps/web/src/components/library/LessonCard.tsx` (viết lại)
- Create: `apps/web/src/components/library/EmptyState.tsx`
- Modify: `apps/web/src/app/(app)/page.tsx` (chỉ phần JSX từ `return (` trở xuống; query giữ nguyên)

**Interfaces:**
- Consumes: `badgeFor`, `progressLabel`, `percent`, `formatDuration`, `Badge`, `ProgressRing`, `Icon`, `cardClass`, `SegmentedControl`.
- Produces: `LessonCard({ lesson: LessonRow, thumbUrl: string|null, progress: { done: number; total: number } })` (progress BẮT BUỘC), `EmptyState({ tab: string })`.

- [ ] **Step 1: Viết lại `LessonCard.tsx`**

```tsx
import Link from "next/link";
import type { LessonRow } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatDuration, percent } from "@/lib/format";
import { badgeFor, progressLabel, type Progress } from "@/lib/lesson-status";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Icon } from "@/components/ui/Icon";
import { cardClass } from "@/components/ui/Card";

export function LessonCard({ lesson, thumbUrl, progress }: { lesson: LessonRow; thumbUrl: string | null; progress: Progress }) {
  const pct = percent(progress.done, progress.total);
  const badge = badgeFor(lesson.status, progress);
  const duration = formatDuration(lesson.duration_sec);
  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className={cn(cardClass, "block overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-card")}
    >
      <div className="relative aspect-video bg-surface-2">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted">
            {lesson.status === "error"
              ? <Icon name="alert-triangle" className="size-10 text-danger" />
              : <Icon name="video-off" className="size-10" />}
          </div>
        )}
        {duration && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {duration}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p lang="ja" className="line-clamp-2 font-jp text-[15px] font-semibold leading-snug">{lesson.title}</p>
        {lesson.lesson_date && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Icon name="calendar" className="size-3.5" />{lesson.lesson_date}
          </p>
        )}
        <div className="mt-1 flex items-center gap-3">
          <ProgressRing value={pct} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold tabular-nums">{progress.done}/{progress.total} câu</p>
            <p className="text-xs text-muted">{progressLabel(lesson.status, progress)}</p>
          </div>
          {badge && <Badge kind={badge.kind}>{badge.label}</Badge>}
        </div>
        {lesson.status === "error" && lesson.ingest_error && (
          <p className="rounded-sm bg-danger-soft px-2.5 py-1.5 font-mono text-xs text-danger">{lesson.ingest_error}</p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Viết `EmptyState.tsx`**

```tsx
import { Icon } from "@/components/ui/Icon";

export function EmptyState({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-muted">
        <Icon name="users" className="size-7" />
      </span>
      <p className="font-semibold">Chưa có bài học nào.</p>
      <p className="max-w-sm text-sm text-muted">
        {tab === "community"
          ? "Khi có bài được chia sẻ vào cộng đồng, bài sẽ hiện ở đây."
          : "Tạo bài mới từ Claude Code bằng skill study-kit, bài sẽ xuất hiện ở đây."}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Sửa JSX trang thư viện**

Trong `apps/web/src/app/(app)/page.tsx`, thêm import:
```tsx
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/library/EmptyState";
```
Thay toàn bộ khối `return (...)` bằng:
```tsx
  const current = tab === "community" ? "community" : "mine";
  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">Thư viện</h1>
        <SegmentedControl
          ariaLabel="Bộ lọc thư viện"
          value={current}
          items={[
            { value: "mine", label: "Của tôi", href: "/?tab=mine" },
            { value: "community", label: "Cộng đồng", href: "/?tab=community" },
          ]}
        />
      </div>
      {withThumbs.length === 0 ? (
        <EmptyState tab={current} />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {withThumbs.map(({ lesson, thumb, progress }) => (
            <LessonCard key={lesson.id} lesson={lesson} thumbUrl={thumb} progress={progress} />
          ))}
        </div>
      )}
    </main>
  );
```

- [ ] **Step 4: Typecheck + kiểm tra thủ công**

Run: `pnpm --filter web typecheck`
Expected: không lỗi.

Mở http://localhost:3000/ → tiêu đề "Thư viện", segmented Của tôi/Cộng đồng đổi URL `?tab=`, card có vòng tiến độ + "x/y câu" + nhãn phụ; bài draft có badge "nháp — chưa có video" và icon video-off khi không có thumbnail. Đổi theme: card trắng ↔ nâu, viền đổi theo.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/library "apps/web/src/app/(app)/page.tsx"
git commit -m "feat(web): library cards with progress ring, status badges and empty state

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Danh sách câu — `CueItem`, `CueList`

**Files:**
- Create: `apps/web/src/components/study/CueItem.tsx`
- Modify: `apps/web/src/components/study/CueList.tsx` (viết lại; props GIỮ NGUYÊN để `StudyView` hiện tại vẫn compile)

**Interfaces:**
- Consumes: `Checkbox`, `Icon`, `formatTimestamp`, `cn`, `CueRow`, `VocabRow`.
- Produces: `CueList(props)` với props y như hiện tại: `{ cues, activeIdx, showTarget, onSeek(i), vocabByCue, doneIds, onToggleDone(cue), editMode, onSaveCue(cueId, patch) }`; root `<section>` có `<ol data-testid="cue-list">`; mỗi `<li>` có `data-testid="cue-item"`, `data-active="true"` khi đang phát.
  `CueItem({ ref?, cue, index, active, done, showTarget, vocab, editMode, onSeek, onToggleDone, onSaveCue(patch) })`.

- [ ] **Step 1: Viết `CueItem.tsx`**

```tsx
"use client";
import type { Ref } from "react";
import type { CueRow, VocabRow } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";

export function CueItem({
  ref, cue, index, active, done, showTarget, vocab, editMode, onSeek, onToggleDone, onSaveCue,
}: {
  ref?: Ref<HTMLLIElement>; cue: CueRow; index: number; active: boolean; done: boolean; showTarget: boolean;
  vocab: VocabRow[]; editMode: boolean; onSeek: () => void; onToggleDone: () => void;
  onSaveCue: (patch: { text_source?: string; text_target?: string }) => void;
}) {
  return (
    <li
      ref={ref} data-testid="cue-item" data-active={active ? "true" : "false"}
      onClick={onSeek}
      className={cn(
        "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-md border-l-[3px] px-3 py-2.5 transition-colors scroll-mt-[330px] lg:scroll-mt-2",
        active ? "border-accent bg-active-cue" : "border-transparent hover:bg-surface-2",
      )}
    >
      <Checkbox checked={done} onChange={onToggleDone} label={`Đã học câu ${index + 1}`} size="lg" className="mt-0.5 lg:size-[26px]" />
      {editMode ? (
        <div onClick={(e) => e.stopPropagation()} className="col-span-2 flex flex-col gap-1.5">
          <input
            lang="ja" defaultValue={cue.text_source}
            className="h-9 w-full rounded-sm border border-line bg-surface px-2.5 font-jp text-sm outline-none focus:border-accent"
            onBlur={(e) => e.target.value !== cue.text_source && onSaveCue({ text_source: e.target.value })}
          />
          <input
            defaultValue={cue.text_target ?? ""}
            className="h-8 w-full rounded-sm border border-line bg-surface px-2.5 text-xs outline-none focus:border-accent"
            onBlur={(e) => e.target.value !== (cue.text_target ?? "") && onSaveCue({ text_target: e.target.value })}
          />
        </div>
      ) : (
        <>
          <div className="min-w-0">
            <p lang="ja" className={cn("font-jp text-[17px] leading-[1.55] lg:text-[15.5px]", active && "font-medium")}>
              {cue.uncertain && (
                <span title={cue.note ?? "Câu chưa chắc chắn"} className="mr-1 inline-flex -translate-y-px align-middle text-warning">
                  <Icon name="alert-triangle" className="size-4" />
                </span>
              )}
              {cue.text_source}
            </p>
            {showTarget && cue.text_target && (
              <p className="mt-0.5 text-[13.5px] leading-snug text-muted lg:text-[13px]">{cue.text_target}</p>
            )}
            {vocab.length > 0 && (
              <p lang="ja" className="mt-1 font-jp text-[12.5px] leading-snug text-accent">
                {vocab.map((v) => `${v.term}${v.reading ? `（${v.reading}）` : ""} ${v.meaning ?? ""}`).join(" · ")}
              </p>
            )}
          </div>
          <span className="text-[11px] tabular-nums text-muted">{formatTimestamp(cue.start_ms)}</span>
        </>
      )}
    </li>
  );
}
```

- [ ] **Step 2: Viết lại `CueList.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";
import type { CueRow, VocabRow } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { CueItem } from "./CueItem";

export function CueList({ cues, activeIdx, showTarget, onSeek, vocabByCue, doneIds, onToggleDone, editMode, onSaveCue }: {
  cues: CueRow[]; activeIdx: number; showTarget: boolean;
  onSeek: (i: number) => void; vocabByCue: Map<string, VocabRow[]>;
  doneIds: Set<string>; onToggleDone: (cue: CueRow) => void;
  editMode: boolean; onSaveCue: (cueId: string, patch: { text_source?: string; text_target?: string }) => void;
}) {
  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [activeIdx]);
  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">
          Câu <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-muted">{cues.length}</span>
        </h2>
        <span className="hidden items-center gap-1 text-[11px] text-muted lg:inline-flex">
          <Icon name="repeat" className="size-3" />tự cuộn theo câu đang phát
        </span>
      </header>
      <ol data-testid="cue-list" className="flex flex-col p-2 lg:max-h-[560px] lg:overflow-y-auto">
        {cues.map((c, i) => (
          <CueItem
            key={c.id} ref={i === activeIdx ? activeRef : undefined}
            cue={c} index={i} active={i === activeIdx} done={doneIds.has(c.id)} showTarget={showTarget}
            vocab={vocabByCue.get(c.id) ?? []} editMode={editMode}
            onSeek={() => onSeek(i)} onToggleDone={() => onToggleDone(c)} onSaveCue={(patch) => onSaveCue(c.id, patch)}
          />
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + kiểm tra thủ công**

Run: `pnpm --filter web typecheck`
Expected: không lỗi (StudyView cũ vẫn truyền đúng props).

Mở một bài học: danh sách câu trong card, checkbox 28px, câu đang phát có nền đào + thanh cam trái, timestamp phải, dòng từ vựng màu cam. Bấm checkbox → tick xanh ngọc "pop", không seek video (stopPropagation). Bấm câu → seek.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/study/CueItem.tsx apps/web/src/components/study/CueList.tsx
git commit -m "feat(web): redesigned cue list with custom checkbox, timestamps and active-cue styling

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `VocabPanel` dùng `Flashcard`

**Files:**
- Modify: `apps/web/src/components/study/VocabPanel.tsx` (viết lại; thêm 1 prop `activeIdx`)
- Modify: `apps/web/src/components/study/StudyView.tsx` (chỉ thêm `activeIdx={activeIdx}` vào `<VocabPanel …/>`)

**Interfaces:**
- Consumes: `Flashcard`, `SegmentedControl`, `Button`, `Icon`, `Input`, `cn`.
- Produces: `VocabPanel({ vocab, knownTerms, onToggleKnown(term, reading, meaning), activeCueId, activeIdx, editMode, onAdd(term, reading, meaning), onRemove(id) })`; root `<section data-testid="vocab-panel">`. Trạng thái `hideKnown` và tab desktop `cue|all` nằm trong panel.

- [ ] **Step 1: Viết lại `VocabPanel.tsx`**

```tsx
"use client";
import { useState } from "react";
import type { VocabRow } from "@/lib/types";
import { Flashcard } from "@/components/ui/Flashcard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";

export function VocabPanel({ vocab, knownTerms, onToggleKnown, activeCueId, activeIdx, editMode, onAdd, onRemove }: {
  vocab: VocabRow[]; knownTerms: Set<string>;
  onToggleKnown: (term: string, reading: string | null, meaning: string | null) => void;
  activeCueId: string | null; activeIdx: number;
  editMode: boolean;
  onAdd: (term: string, reading: string, meaning: string) => void;
  onRemove: (id: string) => void;
}) {
  const [hideKnown, setHideKnown] = useState(false);
  const [tab, setTab] = useState<"cue" | "all">("cue");
  const [newTerm, setNewTerm] = useState("");
  const [newReading, setNewReading] = useState("");
  const [newMeaning, setNewMeaning] = useState("");

  const visible = vocab.filter((v) => !hideKnown || !knownTerms.has(v.term));
  const current = visible.filter((v) => v.cue_id === activeCueId);

  const card = (v: VocabRow, size: "sm" | "lg") => (
    <Flashcard
      key={v.id} term={v.term} reading={v.reading} meaning={v.meaning} size={size}
      known={knownTerms.has(v.term)} current={v.cue_id === activeCueId} editable={editMode}
      onToggleKnown={() => onToggleKnown(v.term, v.reading, v.meaning)}
      onRemove={() => onRemove(v.id)}
    />
  );
  const empty = <p className="text-sm text-muted">Câu này chưa có từ vựng.</p>;
  const sectionTitle = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted";

  return (
    <section data-testid="vocab-panel" className="rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">
          Từ vựng <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-muted">{vocab.length}</span>
        </h2>
        <div className="hidden lg:block">
          <SegmentedControl
            ariaLabel="Phạm vi từ vựng" tight value={tab} onChange={setTab}
            items={[{ value: "cue", label: `Câu này · ${current.length}` }, { value: "all", label: `Tất cả · ${visible.length}` }]}
          />
        </div>
        <Button variant="ghost" size="sm" className="ml-auto" pressed={hideKnown} onClick={() => setHideKnown((h) => !h)}>
          <Icon name={hideKnown ? "eye" : "eye-off"} className="size-4" />
          {hideKnown ? "Hiện" : "Ẩn"} từ thuộc
        </Button>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {/* Desktop: theo tab */}
        <div className="hidden lg:block">
          {tab === "cue" ? (
            current.length ? (
              <div className="flex flex-wrap gap-2">{current.map((v) => card(v, "sm"))}</div>
            ) : (
              <p className="text-sm text-muted">
                Câu này chưa có từ vựng.{" "}
                <button type="button" className="font-medium text-accent underline" onClick={() => setTab("all")}>Xem tất cả</button>
              </p>
            )
          ) : (
            <div className="flex flex-wrap gap-2">{visible.map((v) => card(v, "sm"))}</div>
          )}
        </div>

        {/* Mobile: câu đang phát (thẻ lớn) + cả bài */}
        <div className="flex flex-col gap-4 lg:hidden">
          <div>
            <p className={sectionTitle}>Câu đang phát{activeIdx >= 0 && ` · #${activeIdx + 1}`}</p>
            {current.length ? <div className="flex flex-col gap-2">{current.map((v) => card(v, "lg"))}</div> : empty}
          </div>
          <div>
            <p className={sectionTitle}>Cả bài · {visible.length}</p>
            <div className="flex flex-wrap gap-2">{visible.map((v) => card(v, "sm"))}</div>
          </div>
        </div>

        {editMode && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <p className={sectionTitle}>Thêm từ vào câu đang phát</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input lang="ja" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="単語" className="w-32 [&>input]:h-10 [&>input]:font-jp" />
              <Input lang="ja" value={newReading} onChange={(e) => setNewReading(e.target.value)} placeholder="cách đọc" className="w-32 [&>input]:h-10 [&>input]:font-jp" />
              <Input value={newMeaning} onChange={(e) => setNewMeaning(e.target.value)} placeholder="nghĩa" className="w-40 [&>input]:h-10" />
              <Button
                variant="primary" size="sm"
                disabled={activeCueId == null || !newTerm || !newMeaning}
                onClick={() => { onAdd(newTerm, newReading, newMeaning); setNewTerm(""); setNewReading(""); setNewMeaning(""); }}
              >
                <Icon name="plus" className="size-4" />Thêm vào câu {activeIdx >= 0 ? `#${activeIdx + 1}` : ""}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Truyền `activeIdx` từ `StudyView`**

Trong `StudyView.tsx` hiện tại, sửa dòng `<VocabPanel … activeCueId={…}` thêm prop `activeIdx={activeIdx}`.

- [ ] **Step 3: Typecheck + kiểm tra thủ công**

Run: `pnpm --filter web typecheck && pnpm --filter web test`
Expected: không lỗi, test pass.

Mở bài học trên desktop: panel "Từ vựng · N", tab "Câu này | Tất cả"; rê chuột vào thẻ → lật thấy nghĩa; click → gạch ngang + ✓; "Ẩn từ thuộc" ẩn thẻ đó. Bật Sửa → có ✕ trên thẻ và hàng thêm từ.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/study/VocabPanel.tsx apps/web/src/components/study/StudyView.tsx
git commit -m "feat(web): vocab panel with flip flashcards, current-cue tab and hide-known toggle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Trang học — `StudyControls`, `MobileDock`, `StudyView` responsive

**Files:**
- Create: `apps/web/src/components/study/StudyControls.tsx`
- Create: `apps/web/src/components/study/MobileDock.tsx`
- Modify: `apps/web/src/components/study/StudyView.tsx` (viết lại toàn bộ; state/handlers/effects GIỮ NGUYÊN logic)

**Interfaces:**
- Consumes: `CueList` (Task 7), `VocabPanel` (Task 8), `Button`, `SegmentedControl`, `ProgressRing`, `IconButton`, `Badge`, `Icon`, `badgeFor`, `percent`.
- Produces: `RATES = [0.5, 0.75, 1, 1.25, 1.5]` (export từ `StudyControls.tsx`);
  `type StudyControlsProps = { abActive, onToggleAb, rate, onChangeRate(r), showTarget, onToggleTarget, onMarkUpToActive, onContinue, done, total, canEdit, editMode, onToggleEdit, activeIdx, nextIdx }`;
  `StudyControls(props & { className? })` (dock desktop + dòng hint);
  `MobileDock(Pick<StudyControlsProps, "abActive"|"onToggleAb"|"rate"|"onChangeRate"|"showTarget"|"onToggleTarget"|"onMarkUpToActive"|"onContinue">)` — root `data-testid="mobile-dock"`, nút "Tốc độ" mở popover `role="menu"`.
  `StudyView` props không đổi (trang `lessons/[id]/page.tsx` không sửa).

- [ ] **Step 1: Viết `StudyControls.tsx`**

```tsx
"use client";
import { cn } from "@/lib/cn";
import { percent } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Icon } from "@/components/ui/Icon";

export const RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;

export type StudyControlsProps = {
  abActive: boolean; onToggleAb: () => void;
  rate: number; onChangeRate: (r: number) => void;
  showTarget: boolean; onToggleTarget: () => void;
  onMarkUpToActive: () => void; onContinue: () => void;
  done: number; total: number;
  canEdit: boolean; editMode: boolean; onToggleEdit: () => void;
  activeIdx: number; nextIdx: number;
};

export function StudyControls({
  className, abActive, onToggleAb, rate, onChangeRate, showTarget, onToggleTarget,
  onMarkUpToActive, onContinue, done, total, canEdit, editMode, onToggleEdit, activeIdx, nextIdx,
}: StudyControlsProps & { className?: string }) {
  const hint = abActive && activeIdx >= 0
    ? `Đang lặp câu #${activeIdx + 1} · bấm lại để tắt.`
    : nextIdx >= 0 ? `Tiếp tục sẽ nhảy tới câu #${nextIdx + 1}.` : "Đã học hết mọi câu.";
  return (
    <div className={cn("flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button pressed={abActive} onClick={onToggleAb}><Icon name="repeat" className="size-[17px]" />Lặp câu</Button>
          <span className="ml-1 text-sm text-muted">Tốc độ</span>
          <SegmentedControl
            ariaLabel="Tốc độ phát" tight value={String(rate)} onChange={(v) => onChangeRate(Number(v))}
            items={RATES.map((r) => ({ value: String(r), label: `${r}×` }))}
          />
          <Button onClick={onToggleTarget}>
            <Icon name={showTarget ? "eye-off" : "eye"} className="size-[17px]" />{showTarget ? "Ẩn" : "Hiện"} bản dịch
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onMarkUpToActive} disabled={activeIdx < 0}>
            <Icon name="check-check" className="size-[17px]" />Đã học tới câu đang phát
          </Button>
          <Button variant="primary" onClick={onContinue} disabled={nextIdx < 0}>
            <Icon name="skip-forward" className="size-[17px]" />Tiếp tục
          </Button>
          <span className="ml-1 flex items-center gap-2">
            <ProgressRing value={percent(done, total)} />
            <span className="leading-tight">
              <span className="block text-sm font-semibold tabular-nums">{done}/{total}</span>
              <span className="block text-[11px] text-muted">câu đã học</span>
            </span>
          </span>
          {canEdit && (
            <Button variant="soft" pressed={editMode} onClick={onToggleEdit} className="ml-auto">
              <Icon name="pencil" className="size-[17px]" />Sửa
            </Button>
          )}
        </div>
      </div>
      <p className="min-h-4 px-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
```

- [ ] **Step 2: Viết `MobileDock.tsx`**

```tsx
"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { RATES, type StudyControlsProps } from "./StudyControls";

type MobileDockProps = Pick<StudyControlsProps,
  "abActive" | "onToggleAb" | "rate" | "onChangeRate" | "showTarget" | "onToggleTarget" | "onMarkUpToActive" | "onContinue">;

export function MobileDock({ abActive, onToggleAb, rate, onChangeRate, showTarget, onToggleTarget, onMarkUpToActive, onContinue }: MobileDockProps) {
  const [speedOpen, setSpeedOpen] = useState(false);
  const item = "flex h-[58px] flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium leading-none transition-colors";
  return (
    <div data-testid="mobile-dock" className="fixed inset-x-0 bottom-0 z-20 lg:hidden">
      <div className="relative mx-auto max-w-[1200px] px-2 pb-[env(safe-area-inset-bottom)]">
        {speedOpen && (
          <div role="menu" aria-label="Tốc độ phát" className="absolute bottom-[calc(100%+6px)] left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-line bg-surface p-1 shadow-card">
            {RATES.map((r) => (
              <button
                key={r} type="button" role="menuitemradio" aria-checked={r === rate}
                onClick={() => { onChangeRate(r); setSpeedOpen(false); }}
                className={cn("min-h-[44px] rounded-full px-3 text-sm font-medium tabular-nums", r === rate ? "bg-accent-soft text-accent" : "text-muted")}
              >
                {r}×
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-5 gap-1 rounded-t-lg border border-b-0 border-line bg-surface p-1.5 shadow-card">
          <button type="button" aria-pressed={abActive} onClick={onToggleAb} className={cn(item, abActive ? "bg-accent-soft text-accent" : "text-muted")}>
            <Icon name="repeat" className="size-[22px]" />Lặp câu
          </button>
          <button type="button" aria-expanded={speedOpen} aria-label={`Tốc độ ${rate}×`} onClick={() => setSpeedOpen((o) => !o)} className={cn(item, "text-muted")}>
            <span className="text-base font-bold leading-none tabular-nums text-ink">{rate}×</span>Tốc độ
          </button>
          <button type="button" onClick={onToggleTarget} className={cn(item, "text-muted")}>
            <Icon name={showTarget ? "eye-off" : "eye"} className="size-[22px]" />{showTarget ? "Ẩn dịch" : "Hiện dịch"}
          </button>
          <button type="button" onClick={onMarkUpToActive} className={cn(item, "text-muted")}>
            <Icon name="check-check" className="size-[22px]" />Học tới đây
          </button>
          <button type="button" onClick={onContinue} className={cn(item, "bg-accent text-accent-fg")}>
            <Icon name="skip-forward" className="size-[22px]" />Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Viết lại `StudyView.tsx`**

Giữ nguyên toàn bộ phần state, `saveCueText`, `addVocab`, `removeVocab`, effect player, `seekToCue`, `toggleAb`, `changeRate`, `vocabByCue`, `toggleDone`, `markUpToActive`, `continueStudy`, `toggleKnown` như file hiện tại. Thêm state `mobileTab` và tính `nextIdx`. Thay imports và JSX:

```tsx
"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CueRow, LessonRow, VocabRow } from "@/lib/types";
import { Html5PlayerAdapter, type PlayerAdapter } from "@/lib/player";
import { findActiveCueIndex, nextUndoneIndex } from "@/lib/cues";
import { percent } from "@/lib/format";
import { badgeFor } from "@/lib/lesson-status";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { CueList } from "./CueList";
import { VocabPanel } from "./VocabPanel";
import { StudyControls } from "./StudyControls";
import { MobileDock } from "./MobileDock";

export type StudyViewProps = {
  lesson: LessonRow; cues: CueRow[]; vocab: VocabRow[]; videoUrl: string | null;
  initialDoneCueIds: string[]; initialKnownTerms: string[]; canEdit: boolean; userId: string;
};

export default function StudyView({ lesson, cues, vocab, videoUrl, initialDoneCueIds, initialKnownTerms, canEdit, userId }: StudyViewProps) {
  // ... (toàn bộ state/handlers/effect như file hiện tại — KHÔNG đổi) ...
  const [mobileTab, setMobileTab] = useState<"cues" | "vocab">("cues");
  const nextIdx = nextUndoneIndex(localCues, doneIds);
  const badge = badgeFor(lesson.status, { done: doneIds.size, total: localCues.length });

  const controls = {
    abActive: !!abRange, onToggleAb: toggleAb,
    rate, onChangeRate: changeRate,
    showTarget, onToggleTarget: () => setShowTarget((s) => !s),
    onMarkUpToActive: markUpToActive, onContinue: continueStudy,
    done: doneIds.size, total: localCues.length,
    canEdit, editMode, onToggleEdit: () => setEditMode((e) => !e),
    activeIdx, nextIdx,
  };

  return (
    <main className="pb-[84px] lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6 lg:pb-0">
      {/* Khối trái: sticky trên mobile, tĩnh trên desktop */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-page px-4 pb-2 lg:static lg:mx-0 lg:gap-3 lg:px-0 lg:pb-0">
        <div className="flex h-[52px] items-center gap-1 lg:hidden">
          <Link href="/" aria-label="Về thư viện" className="grid size-[38px] shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
            <Icon name="chevron-left" className="size-5" />
          </Link>
          <h1 lang="ja" className="min-w-0 flex-1 truncate font-jp text-sm font-semibold">{lesson.title}</h1>
          {canEdit && (
            <IconButton label="Sửa bài" aria-pressed={editMode} onClick={() => setEditMode((e) => !e)} className={cn(editMode && "bg-accent-soft text-accent")}>
              <Icon name="pencil" className="size-[18px]" />
            </IconButton>
          )}
        </div>
        <h1 lang="ja" className="hidden font-jp text-xl font-semibold leading-snug lg:block">{lesson.title}</h1>

        <div className="overflow-hidden rounded-md bg-video lg:rounded-lg">
          {videoUrl ? (
            <video ref={videoRef} src={videoUrl} controls playsInline className="aspect-video w-full" />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 text-sm text-[#A89684]">
              <Icon name="video-off" className="size-9" />
              <span>Video chưa sẵn sàng</span>
              {badge && <Badge kind={badge.kind}>{badge.label}</Badge>}
            </div>
          )}
        </div>

        <StudyControls className="hidden lg:flex" {...controls} />

        <div className="flex items-center justify-between gap-2 lg:hidden">
          <SegmentedControl
            ariaLabel="Nội dung" tight value={mobileTab} onChange={setMobileTab}
            items={[
              { value: "cues", label: <>Câu · <span className="tabular-nums">{doneIds.size}/{localCues.length}</span></> },
              { value: "vocab", label: <>Từ vựng · <span className="tabular-nums">{localVocab.length}</span></> },
            ]}
          />
          <ProgressRing value={percent(doneIds.size, localCues.length)} size={32} label />
        </div>
      </div>

      {/* Khối phải */}
      <div className="flex flex-col gap-4 pt-2 lg:pt-0">
        <div className={cn(mobileTab !== "cues" && "hidden lg:block")}>
          <CueList
            cues={localCues} activeIdx={activeIdx} showTarget={showTarget} onSeek={seekToCue}
            vocabByCue={vocabByCue} doneIds={doneIds} onToggleDone={toggleDone}
            editMode={editMode} onSaveCue={saveCueText}
          />
        </div>
        <div className={cn(mobileTab !== "vocab" && "hidden lg:block")}>
          <VocabPanel
            vocab={localVocab} knownTerms={knownTerms} onToggleKnown={toggleKnown}
            activeCueId={activeIdx >= 0 ? localCues[activeIdx].id : null} activeIdx={activeIdx}
            editMode={editMode}
            onAdd={(term, reading, meaning) => activeIdx >= 0 && addVocab(localCues[activeIdx].id, term, reading, meaning)}
            onRemove={removeVocab}
          />
        </div>
      </div>

      <MobileDock {...controls} />
    </main>
  );
}
```

Lưu ý khi ghép: xoá các import không còn dùng; `useEffect`/`useMemo`/`useRef` vẫn cần cho phần logic giữ lại. Không còn `<select>` tốc độ hay nút text cũ.

- [ ] **Step 4: Typecheck + test + kiểm tra thủ công 2 kích cỡ**

Run: `pnpm --filter web typecheck && pnpm --filter web test`
Expected: không lỗi.

Desktop 1280: 2 cột, dock 2 hàng dưới video, hint đổi khi bật "Lặp câu"; "Tiếp tục" disabled khi học hết. Mobile 390 (DevTools device toolbar, chọn thiết bị cảm ứng): app bar + video + tab ghim khi cuộn; tab "Từ vựng" → mục "CÂU ĐANG PHÁT" thẻ lớn, chạm lật, mặt sau có "✓ Đã thuộc"; dock 5 nút ở đáy, "Tốc độ" mở popover; nội dung cuối trang không bị dock che.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/study/StudyControls.tsx apps/web/src/components/study/MobileDock.tsx apps/web/src/components/study/StudyView.tsx
git commit -m "feat(web): study page with control dock, sticky mobile player and bottom dock

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Từ điển — `DictionaryTable` responsive, trang `/dictionary`

**Files:**
- Modify: `apps/web/src/components/dictionary/DictionaryTable.tsx` (viết lại JSX; giữ `DictEntry`, `rows`, `toggleKnown`, `exportCsv`)
- Modify: `apps/web/src/app/(app)/dictionary/page.tsx` (tiêu đề)

**Interfaces:**
- Consumes: `Input`, `Button`, `IconButton`, `Checkbox`, `SegmentedControl`, `Icon`, `cn`.
- Produces: `DictionaryTable({ entries: DictEntry[], userId })` — desktop `<table data-testid="dict-table">` (`hidden md:table`), mobile `<ul data-testid="dict-list">` (`md:hidden`); mỗi dòng/thẻ có `data-term`, checkbox là `role="checkbox"`.

- [ ] **Step 1: Viết lại `DictionaryTable.tsx`**

```tsx
"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Checkbox } from "@/components/ui/Checkbox";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Icon } from "@/components/ui/Icon";

export type DictEntry = {
  lang: string; term: string; reading: string | null; meaning: string | null;
  occurrences: number; lesson_ids: string[]; cue_ids: string[]; is_known: boolean;
};
type Filter = "all" | "unknown" | "known";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" }, { value: "unknown", label: "Chưa thuộc" }, { value: "known", label: "Đã thuộc" },
];

export function DictionaryTable({ entries, userId }: { entries: DictEntry[]; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [known, setKnown] = useState<Set<string>>(new Set(entries.filter((e) => e.is_known).map((e) => `${e.lang}:${e.term}`)));
  const keyOf = (e: DictEntry) => `${e.lang}:${e.term}`;

  const rows = useMemo(() => entries.filter((e) => {
    const k = known.has(keyOf(e));
    if (filter === "known" && !k) return false;
    if (filter === "unknown" && k) return false;
    const s = q.trim().toLowerCase();
    return !s || [e.term, e.reading, e.meaning].some((f) => f?.toLowerCase().includes(s));
  }), [entries, q, filter, known]);

  const toggleKnown = async (e: DictEntry) => {
    const key = keyOf(e);
    const next = new Set(known);
    if (next.has(key)) {
      next.delete(key); setKnown(next);
      await supabase.from("known_words").delete().match({ lang: e.lang, term: e.term });
    } else {
      next.add(key); setKnown(next);
      await supabase.from("known_words").upsert({ user_id: userId, lang: e.lang, term: e.term, reading: e.reading, meaning: e.meaning });
    }
  };

  const exportCsv = () => {
    const esc = (s: string | null) => `"${(s ?? "").replaceAll('"', '""')}"`;
    const csv = ["term,reading,meaning,occurrences,known",
      ...rows.map((e) => [esc(e.term), esc(e.reading), esc(e.meaning), e.occurrences, known.has(keyOf(e))].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = "vingo-dictionary.csv";
    a.click();
  };

  const openHref = (e: DictEntry) => `/lessons/${e.lesson_ids[0]}#cueid=${e.cue_ids[0]}`;
  const countPill = <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-muted">{rows.length} từ</span>;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input icon="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm 単語 / cách đọc / nghĩa" className="w-full md:max-w-[380px]" />
        <div className="flex items-center gap-2">
          <SegmentedControl ariaLabel="Lọc theo trạng thái" tight value={filter} onChange={setFilter} items={FILTERS} />
          <span className="md:hidden">{countPill}</span>
          <IconButton label="Tải CSV" onClick={exportCsv} className="md:hidden"><Icon name="download" className="size-[18px]" /></IconButton>
          <Button onClick={exportCsv} className="hidden md:inline-flex"><Icon name="download" className="size-[17px]" />CSV</Button>
          <span className="ml-auto hidden md:inline">{countPill}</span>
        </div>
      </div>

      {/* Desktop: bảng */}
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
        <table data-testid="dict-table" className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-[11.5px] uppercase tracking-[.06em] text-muted">
            <tr>
              <th className="w-12 px-4 py-2.5"><span className="sr-only">Đã thuộc</span>✓</th>
              <th className="px-3 py-2.5" lang="ja">単語</th><th className="px-3 py-2.5">Cách đọc</th>
              <th className="px-3 py-2.5">Nghĩa</th><th className="px-3 py-2.5">×N</th><th className="px-3 py-2.5">Câu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const k = known.has(keyOf(e));
              return (
                <tr key={keyOf(e)} data-term={e.term} className="border-t border-line transition-colors hover:bg-surface-2">
                  <td className="px-4 py-2.5"><Checkbox round checked={k} onChange={() => toggleKnown(e)} label={`${e.term}: đã thuộc`} /></td>
                  <td lang="ja" className={cn("px-3 py-2.5 font-jp text-base font-medium", k && "line-through text-muted")}>{e.term}</td>
                  <td lang="ja" className="px-3 py-2.5 font-jp text-muted">{e.reading}</td>
                  <td className="px-3 py-2.5">{e.meaning}</td>
                  <td className="px-3 py-2.5"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums">×{e.occurrences}</span></td>
                  <td className="px-3 py-2.5">
                    <a className="inline-flex items-center gap-1 font-medium text-accent hover:underline" href={openHref(e)}>
                      mở câu<Icon name="arrow-up-right" className="size-3.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: thẻ */}
      <ul data-testid="dict-list" className="flex flex-col gap-2.5 md:hidden">
        {rows.map((e) => {
          const k = known.has(keyOf(e));
          return (
            <li key={keyOf(e)} data-term={e.term} className="flex gap-3 rounded-lg border border-line bg-surface p-3">
              <Checkbox round size="lg" checked={k} onChange={() => toggleKnown(e)} label={`${e.term}: đã thuộc`} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p lang="ja" className="font-jp text-[17px] font-medium leading-tight">
                  <span className={cn(k && "line-through text-muted")}>{e.term}</span>
                  {e.reading && <span className="ml-2 text-xs font-normal text-muted">{e.reading}</span>}
                </p>
                {e.meaning && <p className="mt-1 text-sm leading-snug">{e.meaning}</p>}
                <p className="mt-2 flex items-center gap-3 text-xs">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 tabular-nums text-muted">×{e.occurrences}</span>
                  <a className="inline-flex items-center gap-1 font-medium text-accent" href={openHref(e)}>mở câu<Icon name="arrow-up-right" className="size-3.5" /></a>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="py-10 text-center text-sm text-muted">Không có từ nào khớp.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Sửa tiêu đề trang `/dictionary`**

Thay `<h1 className="mb-4 text-xl font-bold">単語帳 — Từ điển</h1>` bằng:
```tsx
      <h1 className="mb-4 flex items-baseline gap-2">
        <span lang="ja" className="font-jp text-base font-medium text-muted">単語帳</span>
        <span className="text-[22px] font-bold tracking-[-0.02em]">Từ điển</span>
      </h1>
```

- [ ] **Step 3: Typecheck + kiểm tra thủ công**

Run: `pnpm --filter web typecheck`
Expected: không lỗi.

Desktop: bảng trong card, thead surface-2, checkbox tròn, hàng đã thuộc gạch ngang; lọc "Đã thuộc" chỉ còn dòng đã tick. Mobile 390: danh sách thẻ, toolbar xếp dọc, icon CSV. CSV vẫn tải được.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dictionary/DictionaryTable.tsx "apps/web/src/app/(app)/dictionary/page.tsx"
git commit -m "feat(web): dictionary table with card layout on mobile and segmented filters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: E2E cập nhật + kiểm tra toàn diện

**Files:**
- Modify: `e2e/smoke.spec.ts` (viết lại)

**Interfaces:**
- Consumes: selector đã định nghĩa ở các task trước: `data-testid="theme-toggle"`, `cue-list`, `cue-item`, `flashcard` (+`data-known`), `vocab-panel`, `mobile-dock`, `dict-table`/`dict-list` (+`data-term`), `role="checkbox"`, link "Của tôi".

- [ ] **Step 1: Viết lại `e2e/smoke.spec.ts`**

```ts
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="email"]', "cat@vingo.local");
  await page.fill('input[name="password"]', "devpass123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("tab", { name: "Của tôi" })).toBeVisible();
}

test("login → thư viện → trang học → từ điển → đánh dấu từ (desktop)", async ({ page }) => {
  await login(page);

  await page.locator("a[href^='/lessons/']").first().click();
  await expect(page.locator("video")).toBeVisible();
  const lessonUrl = page.url();
  await page.getByTestId("cue-item").nth(2).click();          // click câu → seek
  const t = await page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime);
  expect(t).toBeGreaterThan(0);

  // Flashcard hiển thị (desktop): click thẻ = đánh dấu đã thuộc
  const card = page.locator('[data-testid="flashcard"]:visible').first();
  const term = ((await card.locator(".fc-front span[lang='ja']").first().textContent()) ?? "").trim();
  expect(term.length).toBeGreaterThan(0);
  const wasKnown = (await card.getAttribute("data-known")) === "true";
  await card.click();
  await expect(card).toHaveAttribute("data-known", String(!wasKnown));

  // Phản ánh ở /dictionary (bảng desktop)
  await page.goto("/dictionary");
  const row = page.getByTestId("dict-table").locator(`tr[data-term="${term}"]`);
  await expect(row).toBeVisible();
  await expect(row.getByRole("checkbox")).toHaveAttribute("aria-checked", String(!wasKnown));

  // Reload trang học → persist; bấm lại để trả về trạng thái cũ (idempotent)
  await page.goto(lessonUrl);
  await expect(page.locator("video")).toBeVisible();
  const again = page.locator('[data-testid="flashcard"]:visible').first();
  await expect(again).toHaveAttribute("data-known", String(!wasKnown));
  await again.click();
  await expect(again).toHaveAttribute("data-known", String(wasKnown));
});

test("đổi theme sáng/tối lưu cookie và giữ sau reload", async ({ page, context }) => {
  await login(page);
  const html = page.locator("html");
  await page.getByTestId("theme-toggle").click();
  const theme = await html.getAttribute("data-theme");
  expect(["light", "dark"]).toContain(theme);
  const cookie = (await context.cookies()).find((c) => c.name === "vingo-theme");
  expect(cookie?.value).toBe(theme);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", theme!);
  // đảo lại để không ảnh hưởng lần chạy sau
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", theme === "dark" ? "light" : "dark");
});

test.describe("mobile 390", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("dock đáy, tab Từ vựng, flashcard chạm lật rồi đánh dấu qua nút mặt sau", async ({ page }) => {
    await login(page);
    await page.locator("a[href^='/lessons/']").first().click();
    await expect(page.locator("video")).toBeVisible();
    await expect(page.getByTestId("mobile-dock")).toBeVisible();

    await page.getByRole("tab", { name: /Từ vựng/ }).click();
    const card = page.locator('[data-testid="flashcard"]:visible').first();
    const wasKnown = (await card.getAttribute("data-known")) === "true";
    await card.locator(".fc-front").tap();
    await expect(card).toHaveClass(/fc-flipped/);
    await expect(card).toHaveAttribute("data-known", String(wasKnown)); // chạm không đánh dấu
    await card.getByRole("button", { name: wasKnown ? "Bỏ đã thuộc" : "✓ Đã thuộc" }).tap();
    await expect(card).toHaveAttribute("data-known", String(!wasKnown));
    await expect(card).not.toHaveClass(/fc-flipped/);

    // trả lại trạng thái cũ
    await card.locator(".fc-front").tap();
    await card.getByRole("button", { name: !wasKnown ? "Bỏ đã thuộc" : "✓ Đã thuộc" }).tap();
    await expect(card).toHaveAttribute("data-known", String(wasKnown));

    // từ điển dạng thẻ
    await page.goto("/dictionary");
    await expect(page.getByTestId("dict-list")).toBeVisible();
    await expect(page.getByTestId("dict-table")).toBeHidden();
  });
});
```

- [ ] **Step 2: Chạy e2e**

Yêu cầu: Supabase local đang chạy (`supabase status`), dev server `pnpm --filter web dev` đang chạy ở :3000, dữ liệu 5 bài đã migrate.

Run: `pnpm e2e`
Expected: 3 test PASS. Nếu test mobile fail ở `toHaveClass(/fc-flipped/)`: kiểm tra `(hover: hover)` trong emulation — với `isMobile: true` Chromium báo `hover: none`; nếu chạy Firefox (không hỗ trợ isMobile) thì bỏ qua test này bằng `test.skip(browserName !== "chromium")`.

- [ ] **Step 3: Kiểm tra toàn bộ**

```bash
pnpm --filter web typecheck && pnpm --filter web test && pnpm --filter web build
```
Expected: cả 3 xanh. `next build` không cảnh báo về `cookies()` (layout là dynamic — chấp nhận).

- [ ] **Step 4: Checklist thị giác (ghi kết quả vào commit message hoặc PR)**

Với dev server, dùng DevTools đổi theme (bấm toggle) và device toolbar 390×844; duyệt 4 màn hình × 2 theme:
- [ ] Không cuộn ngang ở bất kỳ màn hình/kích cỡ nào.
- [ ] Chữ JP dùng Zen Kaku Gothic New (computed font-family), câu JP mobile ≥17px.
- [ ] Không có UI đè lên `<video>`.
- [ ] Tab qua trang học: focus ring cam hiện trên nút, checkbox, flashcard (flashcard lật khi focus).
- [ ] Dark: card `#26201C` trên nền `#1C1714`, câu đang phát `#3B2A21` + thanh cam `#E8825A`.
- [ ] Light: card trắng trên nền `#FAF6F0`, câu đang phát `#FFF1E6` + thanh cam `#B84A22`.
- [ ] Mobile: video + tab ghim khi cuộn danh sách câu; dock 5 nút không che nội dung cuối; popover tốc độ mở/đóng.
- [ ] Từ điển mobile dạng thẻ; desktop bảng có cuộn ngang trong card khi hẹp.
- [ ] `prefers-reduced-motion` (DevTools → Rendering → emulate): không còn animation lật/pop.

- [ ] **Step 5: Commit**

```bash
git add e2e/smoke.spec.ts
git commit -m "test(e2e): cover redesigned UI, theme toggle persistence and mobile flashcard flow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review (đã chạy khi viết plan)

- **Spec coverage:** 2.1 token → Task 2; 2.2 font → Task 2; 2.3 bo góc → Task 2 (`@theme`); 2.4 component → Task 3–4; 3 theme → Task 1–2 (+ e2e Task 11); 4.1 header → Task 5; 4.2 thư viện → Task 6; 4.3 trang học → Task 7–9; 4.4 flashcard → Task 4 (+ dùng ở Task 8); 4.5 từ điển → Task 10; 4.6 login → Task 5; 6 kiểm thử → Task 1, 4, 11. Điểm lệch có chủ ý so với spec: (a) nút "Ẩn từ thuộc" trên mobile nằm trong header panel Từ vựng thay vì hàng tab (đơn giản hoá state, vẫn 1 chạm); (b) `body` dùng `--bg` thay vì `--canvas` vì app chiếm toàn trang, `canvas` giữ làm token dự phòng.
- **Placeholder scan:** không có TBD/TODO; mọi bước code có code.
- **Type consistency:** `Progress` (`lesson-status.ts`) dùng ở LessonCard; `StudyControlsProps` dùng chung StudyControls/MobileDock/StudyView (`controls` object khớp từng key); `CueList` props không đổi; `VocabPanel` thêm `activeIdx` ở Task 8 và StudyView Task 9 truyền đúng; `Flashcard` props khớp giữa Task 4 và 8; `SegmentedControl` generic `T extends string` — tốc độ truyền `String(rate)` và parse `Number(v)`.
