// apps/web/src/components/ui/Dialog.tsx — native <dialog>, token theme, dùng chung (spec P2 §4.2).
// Mở bằng showModal() khi `open`; Esc (event cancel) và click backdrop gọi onClose — cha giữ state.
"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Dialog({ open, onClose, title, children, footer, className, testId }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; className?: string; testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref} data-testid={testId} aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className={cn("m-auto w-[min(92vw,440px)] rounded-lg border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/40", className)}
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 id={titleId} className="text-[17px] font-bold">{title}</h2>
        <div className="text-sm text-muted">{children}</div>
        {footer && <div className="mt-1 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </dialog>
  );
}
