"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { percent } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Icon } from "@/components/ui/Icon";

export const RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;

export type StudyControlsProps = {
  abActive: boolean; onToggleAb: () => void;
  rate: number; onChangeRate: (r: number) => void;
  showTarget: boolean; onToggleTarget: () => void;
  onMarkUpToActive: () => void; onContinue: () => void;
  done: number; total: number;
  canEdit: boolean; editMode: boolean; onToggleEdit: () => void;
  activeIdx: number; nextIdx: number;
};

// `extra`: slot render trước nút Sửa (StudyView cắm ShareButton cho owner — spec P2 §4.2).
export function StudyControls({
  className, extra, abActive, onToggleAb, rate, onChangeRate, showTarget, onToggleTarget,
  onMarkUpToActive, onContinue, done, total, canEdit, editMode, onToggleEdit, activeIdx, nextIdx,
}: StudyControlsProps & { className?: string; extra?: ReactNode }) {
  const hint = abActive && activeIdx >= 0
    ? `Đang lặp câu #${activeIdx + 1} · bấm lại để tắt.`
    : nextIdx >= 0 ? `Tiếp tục sẽ nhảy tới câu #${nextIdx + 1}.` : "Đã học hết mọi câu.";
  return (
    <div className={cn("flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button pressed={abActive} onClick={onToggleAb}><Icon name="repeat" className="size-[17px]" />Lặp câu</Button>
          <span className="ml-1 text-sm text-muted">Tốc độ</span>
          <SegmentedControl
            ariaLabel="Tốc độ phát" tight value={String(rate)} onChange={(v) => onChangeRate(Number(v))}
            items={RATES.map((r) => ({ value: String(r), label: `${r}×` }))}
          />
          <Button onClick={onToggleTarget}>
            <Icon name={showTarget ? "eye-off" : "eye"} className="size-[17px]" />{showTarget ? "Ẩn" : "Hiện"} bản dịch
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onMarkUpToActive} disabled={activeIdx < 0}>
            <Icon name="check-check" className="size-[17px]" />Đã học tới câu đang phát
          </Button>
          <Button variant="primary" onClick={onContinue} disabled={nextIdx < 0}>
            <Icon name="skip-forward" className="size-[17px]" />Tiếp tục
          </Button>
          <span className="ml-1 flex items-center gap-2">
            <ProgressRing value={percent(done, total)} />
            <span className="leading-tight">
              <span className="block text-sm font-semibold tabular-nums">{done}/{total}</span>
              <span className="block text-[11px] text-muted">câu đã học</span>
            </span>
          </span>
          {(extra || canEdit) && (
            <span className="ml-auto flex items-center gap-2">
              {extra}
              {canEdit && (
                <Button variant="soft" pressed={editMode} onClick={onToggleEdit}>
                  <Icon name="pencil" className="size-[17px]" />Sửa
                </Button>
              )}
            </span>
          )}
        </div>
      </div>
      <p className="min-h-4 px-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
