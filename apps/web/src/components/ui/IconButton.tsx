import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function IconButton({
  label, className, children, type = "button", pressed, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; pressed?: boolean }) {
  return (
    <button
      type={type} aria-label={label} title={label} aria-pressed={pressed}
      className={cn(
        "grid size-[38px] shrink-0 place-items-center rounded-full transition-colors",
        pressed ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
