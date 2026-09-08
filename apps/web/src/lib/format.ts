export function formatDuration(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return null;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

export function formatTimestamp(ms: number): string {
  return formatDuration(ms / 1000) ?? "0:00";
}

export function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

/** Khoảng cách tới hạn ôn (ms) → nhãn ngắn tiếng Việt cho nút chấm SRS. */
export function formatInterval(ms: number): string {
  const min = ms / 60_000;
  if (!Number.isFinite(min) || min < 1) return "<1 phút";
  if (min < 60) return `${Math.round(min)} phút`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)} giờ`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)} ngày`;
  if (d < 365) return `${Math.round(d / 30)} tháng`;
  const y = d / 365;
  const s = y >= 10 ? String(Math.round(y)) : String(Math.round(y * 10) / 10).replace(".", ",");
  return `${s} năm`;
}
