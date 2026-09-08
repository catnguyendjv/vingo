export type PlayerState = "playing" | "paused" | "ended";

export interface PlayerAdapter {
  play(): void;
  pause(): void;
  seekTo(ms: number): void;
  getCurrentTimeMs(): number;
  setRate(rate: number): void;
  onTime(cb: (ms: number) => void): () => void;
  /** Trạng thái phát (spec P2 §3.1): playing / paused / ended. */
  onStateChange(cb: (s: PlayerState) => void): () => void;
  destroy(): void;
}

/** HTML5 <video> — nguồn storage (signed URL, seek qua HTTP Range) hoặc object URL file local. YouTube: `player-youtube.ts`. */
export class Html5PlayerAdapter implements PlayerAdapter {
  private listeners = new Set<(ms: number) => void>();
  private stateListeners = new Set<(s: PlayerState) => void>();
  private raf = 0;
  private onPlay: () => void;
  private onPause: () => void;
  private onEnded: () => void;

  constructor(private video: HTMLVideoElement) {
    const tick = () => {
      if (!this.video.paused) this.listeners.forEach((cb) => cb(this.getCurrentTimeMs()));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    // Map sự kiện <video> → PlayerState.
    this.onPlay = () => this.stateListeners.forEach((cb) => cb("playing"));
    this.onPause = () => this.stateListeners.forEach((cb) => cb("paused"));
    this.onEnded = () => this.stateListeners.forEach((cb) => cb("ended"));
    video.addEventListener("play", this.onPlay);
    video.addEventListener("pause", this.onPause);
    video.addEventListener("ended", this.onEnded);
  }
  play() { this.video.play().catch(() => {}); }
  pause() { this.video.pause(); }
  seekTo(ms: number) { this.video.currentTime = ms / 1000; }
  getCurrentTimeMs() { return Math.round(this.video.currentTime * 1000); }
  setRate(rate: number) { this.video.playbackRate = rate; }
  onTime(cb: (ms: number) => void) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  onStateChange(cb: (s: PlayerState) => void) { this.stateListeners.add(cb); return () => this.stateListeners.delete(cb); }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.video.removeEventListener("play", this.onPlay);
    this.video.removeEventListener("pause", this.onPause);
    this.video.removeEventListener("ended", this.onEnded);
    this.listeners.clear();
    this.stateListeners.clear();
  }
}
