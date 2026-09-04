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
