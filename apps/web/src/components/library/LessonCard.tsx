import Link from "next/link";
import type { LessonRow } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatDuration, percent } from "@/lib/format";
import { badgeFor, progressLabel, type Progress } from "@/lib/lesson-status";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Icon } from "@/components/ui/Icon";
import { cardClass } from "@/components/ui/Card";

export function LessonCard({ lesson, thumbUrl, progress }: { lesson: LessonRow; thumbUrl: string | null; progress: Progress }) {
  const pct = percent(progress.done, progress.total);
  const badge = badgeFor(lesson.status, progress);
  const duration = formatDuration(lesson.duration_sec);
  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className={cn(cardClass, "block overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-card")}
    >
      <div className="relative aspect-video bg-surface-2">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted">
            {lesson.status === "error" ? <Icon name="alert-triangle" className="size-10 text-danger" />
              : lesson.video_provider === "local" ? <Icon name="video" className="size-10" />
              : <Icon name="video-off" className="size-10" />}
          </div>
        )}
        {lesson.video_provider === "local" && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">Video local</span>
        )}
        {duration && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {duration}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p lang="ja" className="line-clamp-2 font-jp text-[15px] font-semibold leading-snug">{lesson.title}</p>
        {lesson.lesson_date && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Icon name="calendar" className="size-3.5" />{lesson.lesson_date}
          </p>
        )}
        <div className="mt-1 flex items-center gap-3">
          <ProgressRing value={pct} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold tabular-nums">{progress.done}/{progress.total} câu</p>
            <p className="text-xs text-muted">{progressLabel(lesson.status, progress)}</p>
          </div>
          {badge && <Badge kind={badge.kind}>{badge.label}</Badge>}
        </div>
        {lesson.status === "error" && lesson.ingest_error && (
          <p className="rounded-sm bg-danger-soft px-2.5 py-1.5 font-mono text-xs text-danger">{lesson.ingest_error}</p>
        )}
      </div>
    </Link>
  );
}
