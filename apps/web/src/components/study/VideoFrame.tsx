"use client";
// Khung video theo provider (spec P2 §3.3). Tạo PlayerAdapter tương ứng và trả về StudyView qua onReady.
import { useEffect, useRef, useState } from "react";
import type { LessonRow } from "@/lib/types";
import type { BadgeKind } from "@/lib/lesson-status";
import { Html5PlayerAdapter, type PlayerAdapter } from "@/lib/player";
import { YouTubePlayerAdapter } from "@/lib/player-youtube";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { LocalVideoSource } from "./LocalVideoSource";

export type VideoFrameProps = {
  lesson: LessonRow;
  videoUrl: string | null;
  localUrl: string | null;
  /** "compact": video thu nhỏ khi cuộn trên điện thoại dọc (spec P2 §6 M2) — chỉ đổi class, cha co bằng width. */
  mode: "full" | "compact";
  onReady: (player: PlayerAdapter) => void;
  onLocalFile: (f: File) => void;
  onLoadedMetadata?: (durationSec: number) => void;
  onError?: (msg: string) => void;
  badge: { kind: BadgeKind; label: string } | null;
};

// Mã lỗi YouTube IFrame API → thông báo (spec §3.2: 100/101/150 = xoá / không cho nhúng).
const YT_ERRORS: Record<number, string> = {
  2: "Mã video không hợp lệ.",
  5: "Trình duyệt không phát được video này.",
  100: "Video đã bị xoá hoặc ở chế độ riêng tư.",
  101: "Chủ video không cho nhúng.",
  150: "Chủ video không cho nhúng.",
};

export function VideoFrame({ lesson, videoUrl, localUrl, mode, onReady, onLocalFile, onLoadedMetadata, onError, badge }: VideoFrameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytRef = useRef<HTMLDivElement>(null);
  const [ytError, setYtError] = useState<string | null>(null);
  // Callback đọc qua ref để effect không phải chạy lại (và không tạo lại player) mỗi khi cha re-render.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const src = videoUrl ?? localUrl;
  const ytId = lesson.video_provider === "youtube" ? lesson.video_ref : null;

  useEffect(() => {
    let player: PlayerAdapter | null = null;
    if (ytId && ytRef.current) {
      setYtError(null);
      player = new YouTubePlayerAdapter(ytRef.current, ytId, {
        onError: (code) => {
          const m = YT_ERRORS[code] ?? "Không phát được video.";
          setYtError(m);
          onErrorRef.current?.(m);
        },
      });
    } else if (src && videoRef.current) {
      player = new Html5PlayerAdapter(videoRef.current);
    }
    if (player) onReadyRef.current(player);
    return () => player?.destroy();
  }, [ytId, src]);

  const frame = cn(
    "overflow-hidden bg-video transition-[width,height] duration-200",
    mode === "compact" ? "rounded-sm" : "rounded-md lg:rounded-lg",
  );

  if (ytId) {
    return (
      <div className={frame}>
        <div className="relative aspect-video w-full">
          <div ref={ytRef} data-testid="youtube-frame" className="absolute inset-0 [&>iframe]:size-full" />
          {ytError && (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-video px-6 text-center text-sm text-[#A89684]">
              <Icon name="alert-triangle" className="size-8" />
              <span>{ytError}</span>
              <a className="underline" href={`https://www.youtube.com/watch?v=${ytId}`} target="_blank" rel="noreferrer">Mở trên YouTube</a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={frame}>
      {src ? (
        <video
          ref={videoRef} src={src} controls playsInline className="aspect-video w-full"
          onLoadedMetadata={(e) => onLoadedMetadata?.(e.currentTarget.duration)}
        />
      ) : lesson.video_provider === "local" ? (
        <LocalVideoSource lesson={lesson} onFile={onLocalFile} />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 text-sm text-[#A89684]">
          <Icon name="video-off" className="size-9" />
          <span>Video chưa sẵn sàng</span>
          {badge && <Badge kind={badge.kind}>{badge.label}</Badge>}
        </div>
      )}
    </div>
  );
}
