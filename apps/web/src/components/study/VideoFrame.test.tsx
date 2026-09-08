// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { LessonRow } from "@/lib/types";
import { VideoFrame } from "./VideoFrame";

const base = {
  id: "l1", title: "t", video_ref: null, duration_sec: null, video_size_bytes: null, status: "ready",
} as unknown as LessonRow;
const common = { mode: "full" as const, onReady: vi.fn(), onLocalFile: vi.fn(), badge: null, localUrl: null };

afterEach(() => { cleanup(); common.onReady.mockClear(); });

describe("VideoFrame", () => {
  it("storage → <video> + adapter ready", () => {
    render(<VideoFrame {...common} lesson={{ ...base, video_provider: "storage" }} videoUrl="blob:x" />);
    expect(document.querySelector("video")?.getAttribute("src")).toBe("blob:x");
    expect(common.onReady).toHaveBeenCalledTimes(1);
    expect(typeof common.onReady.mock.calls[0][0].onStateChange).toBe("function");
  });

  it("local đã chọn file → <video> từ localUrl, báo duration qua onLoadedMetadata", () => {
    const onLoadedMetadata = vi.fn();
    render(
      <VideoFrame {...common} lesson={{ ...base, video_provider: "local" }} videoUrl={null} localUrl="blob:local" onLoadedMetadata={onLoadedMetadata} />,
    );
    const video = document.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("blob:local");
    Object.defineProperty(video, "duration", { value: 125, configurable: true });
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(onLoadedMetadata).toHaveBeenCalledWith(125);
  });

  it("local chưa có file → khung chọn file", () => {
    render(<VideoFrame {...common} lesson={{ ...base, video_provider: "local" }} videoUrl={null} />);
    expect(screen.getByText(/Chọn video trên máy/)).toBeTruthy();
    expect(common.onReady).not.toHaveBeenCalled();
  });

  it("youtube → container iframe", () => {
    render(<VideoFrame {...common} lesson={{ ...base, video_provider: "youtube", video_ref: "abc" }} videoUrl={null} />);
    expect(screen.getByTestId("youtube-frame")).toBeTruthy();
    expect(document.querySelector("video")).toBeNull();
    expect(common.onReady).toHaveBeenCalledTimes(1);
  });

  it("không có nguồn → Video chưa sẵn sàng", () => {
    render(<VideoFrame {...common} lesson={{ ...base, video_provider: "storage", status: "draft" }} videoUrl={null} />);
    expect(screen.getByText(/Video chưa sẵn sàng/)).toBeTruthy();
  });
});
