// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Html5PlayerAdapter } from "./player";

describe("Html5PlayerAdapter.onStateChange", () => {
  it("map play/pause/ended", () => {
    const v = document.createElement("video");
    const p = new Html5PlayerAdapter(v);
    const cb = vi.fn();
    const off = p.onStateChange(cb);
    v.dispatchEvent(new Event("play"));
    v.dispatchEvent(new Event("pause"));
    v.dispatchEvent(new Event("ended"));
    expect(cb.mock.calls.map((c) => c[0])).toEqual(["playing", "paused", "ended"]);
    off();
    v.dispatchEvent(new Event("play"));
    expect(cb).toHaveBeenCalledTimes(3);
    p.destroy();
  });

  it("destroy gỡ listener khỏi <video>", () => {
    const v = document.createElement("video");
    const p = new Html5PlayerAdapter(v);
    const cb = vi.fn();
    p.onStateChange(cb);
    p.destroy();
    v.dispatchEvent(new Event("play"));
    expect(cb).not.toHaveBeenCalled();
  });
});
