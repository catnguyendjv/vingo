"use client";
import type { ScheduleOption } from "@/lib/srs";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

const TONE: Record<number, string> = { 1: "text-danger", 2: "text-warning", 3: "text-ink", 4: "text-success" };

export function ReviewActions({ revealed, options, pending, onReveal, onRate }: {
  revealed: boolean; options: ScheduleOption[] | null; pending: boolean;
  onReveal: () => void; onRate: (o: ScheduleOption) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface p-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0">
      <div className="mx-auto max-w-[560px]">
        {!revealed || !options ? (
          <Button variant="primary" className="min-h-[52px] w-full justify-center text-base" onClick={onReveal}>
            Hiện đáp án
            <kbd className="hidden rounded-sm border border-accent-fg/40 px-1.5 py-0.5 text-[11px] font-normal opacity-80 lg:inline">Space</kbd>
          </Button>
        ) : (
          <div role="group" aria-label="Chấm thẻ" className="grid grid-cols-4 gap-2">
            {options.map((o) => (
              <button
                key={o.rating} type="button" data-testid={`review-rating-${o.rating}`}
                disabled={pending} onClick={() => onRate(o)}
                aria-label={`${o.label} (${o.intervalLabel})`}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-md border border-line bg-surface leading-none transition-colors hover:border-muted hover:bg-surface-2 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50",
                  TONE[o.rating],
                )}
              >
                <span className="text-sm font-semibold">{o.label}</span>
                <span className="text-[11px] tabular-nums text-muted">{o.intervalLabel}</span>
                <kbd className="mt-0.5 hidden text-[10px] text-muted lg:block">{o.key}</kbd>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
