// Kiểu tối thiểu cho YouTube IFrame Player API (spec P2 §3.2) — chỉ những gì YouTubePlayerAdapter dùng.
declare namespace YT {
  enum PlayerState { UNSTARTED = -1, ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3, CUED = 5 }
  interface Player {
    playVideo(): void;
    pauseVideo(): void;
    seekTo(s: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    setPlaybackRate(r: number): void;
    getPlaybackRate(): number;
    destroy(): void;
  }
  interface PlayerOptions {
    videoId: string;
    width?: string | number;
    height?: string | number;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (e: { target: Player }) => void;
      onStateChange?: (e: { data: number }) => void;
      onError?: (e: { data: number }) => void;
    };
  }
  const Player: new (el: HTMLElement | string, opts: PlayerOptions) => Player;
}
interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
