// Kiểu tối thiểu cho File System Access API (Chrome/Edge) — TS lib.dom chưa có showOpenFilePicker/requestPermission.
interface Window {
  showOpenFilePicker(opts?: { multiple?: boolean; types?: { description?: string; accept: Record<string, string[]> }[] }): Promise<FileSystemFileHandle[]>;
}
interface FileSystemHandle {
  requestPermission(d?: { mode?: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
}
