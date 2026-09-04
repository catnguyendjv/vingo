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
