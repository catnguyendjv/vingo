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
