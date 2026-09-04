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
