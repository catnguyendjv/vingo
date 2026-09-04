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
