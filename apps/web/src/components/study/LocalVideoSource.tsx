"use client";
import { useEffect, useState } from "react";
import type { LessonRow } from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { forgetHandle, loadHandle, saveHandle, supportsFileHandles } from "@/lib/local-video";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type Props = { lesson: Pick<LessonRow, "id" | "video_ref" | "duration_sec" | "video_size_bytes">; onFile: (file: File) => void };

/** Khung "Chọn video trên máy" cho bài video_provider = 'local' (spec P2 §2.6, P2-2). */
export function LocalVideoSource({ lesson, onFile }: Props) {
  const [remembered, setRemembered] = useState<FileSystemFileHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canHandle = supportsFileHandles();

  // Handle đã lưu (IndexedDB) → nút "Mở lại"; chỉ khi trình duyệt có File System Access API.
  useEffect(() => {
    if (!canHandle) return;
    loadHandle(lesson.id).then(setRemembered).catch(() => setRemembered(null));
  }, [lesson.id, canHandle]);

  const pickWithHandle = async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "Video", accept: { "video/*": [".mp4", ".mov", ".m4v", ".webm"] } }],
        multiple: false,
      });
      await saveHandle(lesson.id, handle);
      setRemembered(handle);
      setError(null);
      onFile(await handle.getFile());
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") setError("Không mở được file.");
    }
  };
  // requestPermission phải chạy trong cử chỉ người dùng; bị từ chối / file mất → quên handle.
  const reopen = async () => {
    if (!remembered) return;
    try {
      const perm = await remembered.requestPermission({ mode: "read" });
      if (perm !== "granted") throw new Error("denied");
      setError(null);
      onFile(await remembered.getFile());
    } catch {
      await forgetHandle(lesson.id);
      setRemembered(null);
      setError("File đã đổi chỗ hoặc bị từ chối — chọn lại.");
    }
  };

  const duration = formatDuration(lesson.duration_sec);
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[#A89684]">
      <Icon name="folder-open" className="size-9" />
      <p>Video của bài này nằm trên máy bạn, chưa lưu cloud.</p>
      {(lesson.video_ref || duration) && (
        <p className="text-xs">
          Gợi ý: {lesson.video_ref && <span className="font-mono">{lesson.video_ref}</span>}
          {lesson.video_ref && duration && " · "}
          {duration}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {remembered && (
          <Button variant="primary" onClick={reopen} data-testid="local-video-reopen">Mở lại {remembered.name}</Button>
        )}
        {canHandle ? (
          <Button variant={remembered ? "default" : "primary"} onClick={pickWithHandle} data-testid="local-video-pick">
            <Icon name="video" className="size-[17px]" />Chọn video trên máy
          </Button>
        ) : (
          <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-accent bg-accent px-4 text-sm font-semibold text-accent-fg">
            <Icon name="video" className="size-[17px]" />Chọn video trên máy
            <input
              data-testid="local-video-input" type="file" accept="video/*" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
            />
          </label>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
