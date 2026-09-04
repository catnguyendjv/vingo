"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type FlashcardProps = {
  term: string; reading: string | null; meaning: string | null;
  known: boolean; current?: boolean; size?: "sm" | "lg"; editable?: boolean;
  onToggleKnown: () => void; onRemove?: () => void;
};

function hoverCapable(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
}

export function Flashcard({ term, reading, meaning, known, current, size = "sm", editable, onToggleKnown, onRemove }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);
  const [focused, setFocused] = useState(false);
  const revealed = flipped || focused;
  const lg = size === "lg";
  const face = cn(
    "col-start-1 row-start-1 flex flex-col justify-center rounded-md border text-left",
    lg ? "px-4 py-3" : "px-3 py-2",
  );
  const readingCls = cn("font-jp leading-tight text-muted", lg ? "text-xs" : "text-[11px]");

  const handleCardClick = () => {
    if (hoverCapable()) onToggleKnown();
    else setFlipped((f) => !f);
  };

  return (
    <div
      data-testid="flashcard" data-known={known ? "true" : "false"}
      className={cn("fc relative inline-grid", lg && "w-full", flipped && "fc-flipped")}
      onClick={handleCardClick}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
    >
      <button
        type="button"
        aria-label={`${term}: ${known ? "bỏ đánh dấu đã thuộc" : "đánh dấu đã thuộc"}`}
        className={cn(
          face, "fc-front",
          current ? "border-accent bg-accent-soft ring-1 ring-inset ring-accent" : "border-line bg-surface hover:border-muted",
          known && "border-dashed",
        )}
      >
        <span lang="ja" className={cn("flex items-center gap-1.5 font-jp font-medium leading-tight", lg ? "text-[17px]" : "text-[15px]", known && "line-through text-muted decoration-muted")}>
          {term}
          {known && <Icon name="check" className="size-3.5 text-success" strokeWidth={3} />}
        </span>
        {reading && <span lang="ja" className={readingCls}>{reading}</span>}
      </button>

      <div className={cn(face, "fc-back border-line bg-surface-2")} aria-hidden={!revealed}>
        {reading && <span lang="ja" className={readingCls}>{reading}</span>}
        <span className={cn("leading-snug text-ink", lg ? "text-sm" : "text-[13px]")}>{meaning ?? "—"}</span>
        <span className="fc-actions mt-1.5 flex gap-1.5">
          <button
            type="button"
            tabIndex={revealed ? 0 : -1}
            onClick={(e) => { e.stopPropagation(); onToggleKnown(); setFlipped(false); }}
            className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium hover:border-muted"
          >
            {known ? "Bỏ đã thuộc" : "✓ Đã thuộc"}
          </button>
          <button
            type="button"
            tabIndex={revealed ? 0 : -1}
            onClick={(e) => { e.stopPropagation(); setFlipped(false); }}
            className="rounded-full px-2 py-0.5 text-[11px] text-muted"
          >
            Đóng
          </button>
        </span>
      </div>

      {editable && onRemove && (
        <button
          type="button" aria-label={`Xoá từ ${term}`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -right-1.5 -top-1.5 z-10 grid size-[18px] place-items-center rounded-full bg-danger text-white"
        >
          <Icon name="x" className="size-3" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
