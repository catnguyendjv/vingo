// YouTube IFrame API adapter (spec P2 §3.2). Không autoplay; thời gian lấy bằng poll 250ms + nội suy rAF.
import type { PlayerAdapter, PlayerState } from "./player";

const POLL_MS = 250;
let apiPromise: Promise<typeof YT> | null = null;

/** Chèn script iframe_api một lần cho cả app; resolve ở onYouTubeIframeAPIReady. */
export function loadYouTubeApi(): Promise<typeof YT> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

/** Nội suy vị trí giữa 2 lần poll: last + (now − lastAt) × rate. */
export function interpolate(lastMs: number, lastAt: number, now: number, rate: number): number {
  return Math.round(lastMs + (now - lastAt) * rate);
}

export class YouTubePlayerAdapter implements PlayerAdapter {
  private player: YT.Player | null = null;
  private ready = false;
  private destroyed = false;
  // Lệnh gọi trước onReady được xếp hàng và áp một lần khi player sẵn sàng.
  private pending: { seekMs?: number; rate?: number; play?: boolean } = {};
  private timeListeners = new Set<(ms: number) => void>();
  private stateListeners = new Set<(s: PlayerState) => void>();
  private poll = 0;
  private raf = 0;
  private lastMs = 0;
  private lastAt = 0;
  private rate = 1;
  private playing = false;

  constructor(
    container: HTMLElement,
    videoId: string,
    private opts: { onError: (code: number) => void; onReady?: () => void },
  ) {
    loadYouTubeApi()
      .then((yt) => {
        if (this.destroyed) return;
        this.player = new yt.Player(container, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, autoplay: 0 },
          events: {
            onReady: () => {
              if (this.destroyed || !this.player) return;
              this.ready = true;
              if (this.pending.rate) this.player.setPlaybackRate(this.pending.rate);
              if (this.pending.seekMs != null) this.player.seekTo(this.pending.seekMs / 1000, true);
              if (this.pending.play) this.player.playVideo();
              this.pending = {};
              this.opts.onReady?.();
            },
            onStateChange: (e) => this.handleState(e.data),
            onError: (e) => this.opts.onError(e.data),
          },
        });
      })
      .catch(() => this.opts.onError(-1));
  }

  private handleState(code: number) {
    const S = window.YT!.PlayerState;
    if (code === S.PLAYING) { this.playing = true; this.startPolling(); this.emit("playing"); }
    else if (code === S.PAUSED) { this.playing = false; this.stopPolling(); this.emit("paused"); }
    else if (code === S.ENDED) { this.playing = false; this.stopPolling(); this.emit("ended"); }
  }
  private emit(s: PlayerState) { this.stateListeners.forEach((cb) => cb(s)); }
  private sample() {
    if (!this.player) return;
    this.lastMs = Math.round(this.player.getCurrentTime() * 1000);
    this.lastAt = performance.now();
    this.rate = this.player.getPlaybackRate?.() ?? this.rate;
    this.timeListeners.forEach((cb) => cb(this.lastMs));
  }
  private startPolling() {
    this.stopPolling();
    this.sample();
    this.poll = window.setInterval(() => this.sample(), POLL_MS);
    const tick = () => {
      if (!this.playing) return;
      const ms = interpolate(this.lastMs, this.lastAt, performance.now(), this.rate);
      this.timeListeners.forEach((cb) => cb(ms));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  private stopPolling() { window.clearInterval(this.poll); cancelAnimationFrame(this.raf); }

  play() { if (this.ready) this.player!.playVideo(); else this.pending.play = true; }
  pause() { this.player?.pauseVideo(); }
  seekTo(ms: number) {
    if (this.ready) this.player!.seekTo(ms / 1000, true); else this.pending.seekMs = ms;
    this.lastMs = ms;
    this.lastAt = performance.now();
  }
  getCurrentTimeMs() { return this.ready ? Math.round(this.player!.getCurrentTime() * 1000) : this.lastMs; }
  setRate(rate: number) {
    this.rate = rate;
    if (this.ready) this.player!.setPlaybackRate(rate); else this.pending.rate = rate;
  }
  onTime(cb: (ms: number) => void) { this.timeListeners.add(cb); return () => this.timeListeners.delete(cb); }
  onStateChange(cb: (s: PlayerState) => void) { this.stateListeners.add(cb); return () => this.stateListeners.delete(cb); }
  destroy() {
    this.destroyed = true;
    this.stopPolling();
    this.timeListeners.clear();
    this.stateListeners.clear();
    this.player?.destroy();
    this.player = null;
  }
}
