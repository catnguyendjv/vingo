export interface PlayerAdapter {
  play(): void;
  pause(): void;
  seekTo(ms: number): void;
  getCurrentTimeMs(): number;
  setRate(rate: number): void;
  onTime(cb: (ms: number) => void): () => void;
  destroy(): void;
}

/** HTML5 <video> — nguồn storage (signed URL, seek qua HTTP Range). YouTube impl vào P2. */
export class Html5PlayerAdapter implements PlayerAdapter {
  private listeners = new Set<(ms: number) => void>();
  private raf = 0;

  constructor(private video: HTMLVideoElement) {
    const tick = () => {
      if (!this.video.paused) this.listeners.forEach((cb) => cb(this.getCurrentTimeMs()));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  play() { void this.video.play(); }
  pause() { this.video.pause(); }
  seekTo(ms: number) { this.video.currentTime = ms / 1000; }
  getCurrentTimeMs() { return Math.round(this.video.currentTime * 1000); }
  setRate(rate: number) { this.video.playbackRate = rate; }
  onTime(cb: (ms: number) => void) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  destroy() { cancelAnimationFrame(this.raf); this.listeners.clear(); }
}
