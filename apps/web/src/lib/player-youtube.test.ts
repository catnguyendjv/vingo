// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YouTubePlayerAdapter, interpolate } from "./player-youtube";

type Events = NonNullable<YT.PlayerOptions["events"]>;
let events: Events;
let fake: YT.Player & { t: number; rate: number };

beforeEach(() => {
  vi.useFakeTimers();
  fake = {
    t: 0, rate: 1,
    playVideo: vi.fn(), pauseVideo: vi.fn(), destroy: vi.fn(),
    seekTo: vi.fn((s: number) => { fake.t = s; }), getCurrentTime: () => fake.t,
    setPlaybackRate: vi.fn((r: number) => { fake.rate = r; }), getPlaybackRate: () => fake.rate,
  };
  window.YT = {
    PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    Player: vi.fn((_el: HTMLElement, opts: YT.PlayerOptions) => {
      events = opts.events!;
      queueMicrotask(() => events.onReady!({ target: fake }));
      return fake;
    }),
  } as unknown as typeof YT;
});
// `typeof globalThis` có YT (từ declare namespace) không optional → cast để xoá.
afterEach(() => { vi.useRealTimers(); delete (window as { YT?: typeof YT }).YT; });

describe("interpolate", () => {
  it("nội suy theo rate", () => { expect(interpolate(10_000, 1000, 1500, 1.5)).toBe(10_750); });
});

describe("YouTubePlayerAdapter", () => {
  it("poll khi PLAYING, phát state, map error", async () => {
    const onError = vi.fn();
    const p = new YouTubePlayerAdapter(document.createElement("div"), "abc", { onError });
    await vi.advanceTimersByTimeAsync(0);
    expect(window.YT!.Player).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      videoId: "abc", playerVars: expect.objectContaining({ autoplay: 0, playsinline: 1 }),
    }));
    const times: number[] = []; const states: string[] = [];
    p.onTime((ms) => times.push(ms)); p.onStateChange((s) => states.push(s));
    events.onStateChange!({ data: 1 }); fake.t = 4;
    await vi.advanceTimersByTimeAsync(260);
    expect(times.at(-1)).toBe(4000);
    events.onStateChange!({ data: 2 }); events.onStateChange!({ data: 0 });
    expect(states).toEqual(["playing", "paused", "ended"]);
    events.onError!({ data: 150 });
    expect(onError).toHaveBeenCalledWith(150);
    p.seekTo(12_500); expect(fake.seekTo).toHaveBeenCalledWith(12.5, true);
    p.setRate(1.25); expect(fake.setPlaybackRate).toHaveBeenCalledWith(1.25);
    p.destroy(); expect(fake.destroy).toHaveBeenCalled();
  });

  it("seek trước khi ready được xếp hàng và áp sau onReady", async () => {
    const p = new YouTubePlayerAdapter(document.createElement("div"), "abc", { onError: () => {} });
    p.seekTo(3000);
    expect(fake.seekTo).not.toHaveBeenCalled();
    expect(p.getCurrentTimeMs()).toBe(3000);
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.seekTo).toHaveBeenCalledWith(3, true);
    p.destroy();
  });

  it("dừng poll khi paused; destroy trước khi API sẵn sàng thì không tạo player", async () => {
    const p = new YouTubePlayerAdapter(document.createElement("div"), "abc", { onError: () => {} });
    await vi.advanceTimersByTimeAsync(0);
    const times: number[] = [];
    p.onTime((ms) => times.push(ms));
    events.onStateChange!({ data: 1 });
    events.onStateChange!({ data: 2 });
    const n = times.length;
    fake.t = 9;
    await vi.advanceTimersByTimeAsync(600);
    expect(times.length).toBe(n);
    p.destroy();

    (window.YT!.Player as unknown as ReturnType<typeof vi.fn>).mockClear();
    const q = new YouTubePlayerAdapter(document.createElement("div"), "def", { onError: () => {} });
    q.destroy();
    await vi.advanceTimersByTimeAsync(0);
    expect(window.YT!.Player).not.toHaveBeenCalled();
  });
});
