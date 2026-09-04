import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const cardClass = "rounded-lg border border-line bg-surface";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(cardClass, className)}>{children}</div>;
}
