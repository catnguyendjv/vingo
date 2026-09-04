import { cn } from "@/lib/cn";

export function ProgressRing({ value, size = 36, label, className }: { value: number; size?: number; label?: boolean; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const done = v >= 100;
  return (
    <span role="img" aria-label={`${v}%`} className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="size-full -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.4" className="stroke-line" />
        <circle
          cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.4" strokeLinecap="round"
          pathLength={100} strokeDasharray={`${v} 100`}
          className={cn("transition-[stroke-dasharray] duration-500", done ? "stroke-success" : "stroke-accent")}
        />
      </svg>
      {label && <span className="absolute text-[10px] font-bold tabular-nums">{v}%</span>}
    </span>
  );
}
