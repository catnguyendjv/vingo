"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { RATES, type StudyControlsProps } from "./StudyControls";

type MobileDockProps = Pick<StudyControlsProps,
  "abActive" | "onToggleAb" | "rate" | "onChangeRate" | "showTarget" | "onToggleTarget" | "onMarkUpToActive" | "onContinue">;

export function MobileDock({ abActive, onToggleAb, rate, onChangeRate, showTarget, onToggleTarget, onMarkUpToActive, onContinue }: MobileDockProps) {
  const [speedOpen, setSpeedOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const item = "flex h-[58px] flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium leading-none transition-colors";

  useEffect(() => {
    if (!speedOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setSpeedOpen(false); };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setSpeedOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [speedOpen]);

  return (
    <div ref={rootRef} data-testid="mobile-dock" className="fixed inset-x-0 bottom-0 z-20 lg:hidden land:hidden">
      <div className="relative mx-auto max-w-[1200px] px-2 pb-[env(safe-area-inset-bottom)]">
        {speedOpen && (
          <div role="menu" aria-label="Tốc độ phát" className="absolute bottom-[calc(100%+6px)] left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-line bg-surface p-1 shadow-card">
            {RATES.map((r) => (
              <button
                key={r} type="button" role="menuitemradio" aria-checked={r === rate}
                onClick={() => { onChangeRate(r); setSpeedOpen(false); }}
                className={cn("min-h-[44px] rounded-full px-3 text-sm font-medium tabular-nums", r === rate ? "bg-accent-soft text-accent" : "text-muted")}
              >
                {r}×
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-5 gap-1 rounded-t-lg border border-b-0 border-line bg-surface p-1.5 shadow-card">
          <button type="button" aria-pressed={abActive} onClick={onToggleAb} className={cn(item, abActive ? "bg-accent-soft text-accent" : "text-muted")}>
            <Icon name="repeat" className="size-[22px]" />Lặp câu
          </button>
          <button type="button" aria-expanded={speedOpen} aria-label={`Tốc độ ${rate}×`} onClick={() => setSpeedOpen((o) => !o)} className={cn(item, "text-muted")}>
            <span className="text-base font-bold leading-none tabular-nums text-ink">{rate}×</span>Tốc độ
          </button>
          <button type="button" onClick={onToggleTarget} className={cn(item, "text-muted")}>
            <Icon name={showTarget ? "eye-off" : "eye"} className="size-[22px]" />{showTarget ? "Ẩn dịch" : "Hiện dịch"}
          </button>
          <button type="button" onClick={onMarkUpToActive} className={cn(item, "text-muted")}>
            <Icon name="check-check" className="size-[22px]" />Học tới đây
          </button>
          <button type="button" onClick={onContinue} className={cn(item, "bg-accent text-accent-fg")}>
            <Icon name="skip-forward" className="size-[22px]" />Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
