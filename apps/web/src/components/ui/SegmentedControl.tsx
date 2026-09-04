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
