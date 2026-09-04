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
