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
