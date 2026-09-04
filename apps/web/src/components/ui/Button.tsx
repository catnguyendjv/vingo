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
