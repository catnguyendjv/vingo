// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWakeLock } from "./use-wake-lock";

describe("useWakeLock", () => {
  it("request khi active, release khi tắt; không có API thì bỏ qua", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release, released: false });
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    const { rerender, unmount } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    await Promise.resolve();
    expect(request).toHaveBeenCalledWith("screen");
    rerender({ on: false });
    await Promise.resolve();
    expect(release).toHaveBeenCalled();
    unmount();
    Object.defineProperty(navigator, "wakeLock", { value: undefined, configurable: true });
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });
});
