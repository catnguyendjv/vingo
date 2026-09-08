export function findActiveCueIndex(
  cues: { start_ms: number; end_ms: number }[], timeMs: number,
): number {
  let active = -1;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start_ms <= timeMs) active = i; else break;
  }
  return active;
}

export function nextUndoneIndex(cues: { id: string }[], doneIds: Set<string>): number {
  for (let i = 0; i < cues.length; i++) if (!doneIds.has(cues[i].id)) return i;
  return -1;
}

/** Chỉ số câu khi bấm ‹ › : chưa có câu đang phát → fallback (câu chưa học đầu, hoặc 0). Kẹp trong [0, total-1]. */
export function stepIndex(activeIdx: number, delta: 1 | -1, total: number, fallback: number): number {
  if (total <= 0) return -1;
  if (activeIdx < 0) return Math.max(0, Math.min(total - 1, fallback < 0 ? 0 : fallback));
  return Math.max(0, Math.min(total - 1, activeIdx + delta));
}
