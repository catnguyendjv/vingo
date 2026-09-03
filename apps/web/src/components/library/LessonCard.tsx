import Link from "next/link";
import type { LessonRow } from "@/lib/types";

const BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "nháp — chưa có video", cls: "bg-gray-200 text-gray-700" },
  processing: { label: "đang xử lý video…", cls: "bg-amber-100 text-amber-800" },
  error: { label: "lỗi xử lý video", cls: "bg-red-100 text-red-700" },
};

export function LessonCard({ lesson, thumbUrl }: { lesson: LessonRow; thumbUrl: string | null }) {
  const badge = BADGE[lesson.status];
  return (
    <Link href={`/lessons/${lesson.id}`} className="block overflow-hidden rounded-lg border hover:shadow">
      <div className="aspect-video bg-gray-100">
        {thumbUrl && <img src={thumbUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="p-3">
        <p className="font-medium">{lesson.title}</p>
        <p className="text-xs text-gray-500">{lesson.lesson_date ?? ""}</p>
        {badge && <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>}
        {lesson.status === "error" && lesson.ingest_error && (
          <p className="mt-1 text-xs text-red-600">{lesson.ingest_error}</p>
        )}
      </div>
    </Link>
  );
}
