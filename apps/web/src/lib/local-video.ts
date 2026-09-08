// apps/web/src/lib/local-video.ts — video_provider 'local' (spec P2 §2.6): thuần, không React.
import type { LessonRow } from "./types";

const DURATION_TOLERANCE_SEC = 2;
const DB_NAME = "vingo-local-video";
const STORE = "handles";

/** File System Access API (Chrome/Edge desktop) — cho phép nhớ handle để "Mở lại" lần sau. */
export function supportsFileHandles(w: Window | undefined = typeof window === "undefined" ? undefined : window): boolean {
  return !!w && "showOpenFilePicker" in w;
}

/** So file người học chọn với metadata bài. Chỉ cảnh báo, không chặn. Trường lesson null → bỏ kiểm. */
export function checkMatch(
  file: { size: number },
  durationSec: number | null,
  lesson: Pick<LessonRow, "duration_sec" | "video_size_bytes">,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (lesson.duration_sec != null && durationSec != null && Math.abs(durationSec - lesson.duration_sec) > DURATION_TOLERANCE_SEC)
    reasons.push("thời lượng lệch bản gốc");
  if (lesson.video_size_bytes != null && file.size !== lesson.video_size_bytes)
    reasons.push("kích cỡ file khác bản gốc");
  return { ok: reasons.length === 0, reasons };
}

// IndexedDB `vingo-local-video` / store `handles`: key = lesson.id, value = FileSystemFileHandle.
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => { resolve(req.result); db.close(); };
    req.onerror = () => { reject(req.error); db.close(); };
  }));
}
export const saveHandle = (lessonId: string, h: FileSystemFileHandle): Promise<void> =>
  tx("readwrite", (s) => s.put(h, lessonId)).then(() => undefined);
export const loadHandle = (lessonId: string): Promise<FileSystemFileHandle | null> =>
  tx<FileSystemFileHandle | undefined>("readonly", (s) => s.get(lessonId)).then((v) => v ?? null);
export const forgetHandle = (lessonId: string): Promise<void> =>
  tx("readwrite", (s) => s.delete(lessonId)).then(() => undefined);
