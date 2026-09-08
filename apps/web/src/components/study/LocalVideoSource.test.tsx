// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocalVideoSource } from "./LocalVideoSource";

// Handle giả có function → IndexedDB (kể cả fake) không structured-clone được; thay store bằng Map.
const store = new Map<string, FileSystemFileHandle>();
vi.mock("@/lib/local-video", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/local-video")>()),
  saveHandle: async (id: string, h: FileSystemFileHandle) => { store.set(id, h); },
  loadHandle: async (id: string) => store.get(id) ?? null,
  forgetHandle: async (id: string) => { store.delete(id); },
}));

type Lesson = Parameters<typeof LocalVideoSource>[0]["lesson"];
const lesson: Lesson = { id: "l1", video_ref: "meeting.mp4", duration_sec: 125, video_size_bytes: null };
const setPicker = (fn: unknown) => { (window as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = fn; };

afterEach(() => {
  cleanup();
  store.clear();
  delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
});

describe("LocalVideoSource", () => {
  it("hiện gợi ý tên file + thời lượng và gọi onFile khi chọn (input fallback)", () => {
    const onFile = vi.fn();
    render(<LocalVideoSource lesson={lesson} onFile={onFile} />);
    expect(screen.getByText(/meeting\.mp4/)).toBeTruthy();
    expect(screen.getByText(/2:05/)).toBeTruthy();
    const input = screen.getByTestId("local-video-input") as HTMLInputElement;
    const file = new File(["x"], "meeting.mp4", { type: "video/mp4" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("có showOpenFilePicker: dùng picker, lưu handle và gọi onFile", async () => {
    const file = new File(["x"], "a.mp4", { type: "video/mp4" });
    const handle = { name: "a.mp4", getFile: async () => file } as unknown as FileSystemFileHandle;
    setPicker(vi.fn(async () => [handle]));
    const onFile = vi.fn();
    render(<LocalVideoSource lesson={{ ...lesson, id: "l2" }} onFile={onFile} />);
    expect(screen.queryByTestId("local-video-input")).toBeNull();
    fireEvent.click(screen.getByTestId("local-video-pick"));
    await waitFor(() => expect(onFile).toHaveBeenCalledWith(file));
    expect(store.get("l2")).toBe(handle);
    await waitFor(() => expect(screen.getByTestId("local-video-reopen").textContent).toMatch(/a\.mp4/));
  });

  it("handle đã lưu: Mở lại bị từ chối → quên handle, báo lỗi", async () => {
    setPicker(vi.fn());
    const handle = {
      name: "old.mp4", requestPermission: async () => "denied", getFile: async () => new File([], "old.mp4"),
    } as unknown as FileSystemFileHandle;
    store.set("l3", handle);
    const onFile = vi.fn();
    render(<LocalVideoSource lesson={{ ...lesson, id: "l3" }} onFile={onFile} />);
    fireEvent.click(await screen.findByTestId("local-video-reopen"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/chọn lại/));
    expect(onFile).not.toHaveBeenCalled();
    expect(store.has("l3")).toBe(false);
    expect(screen.queryByTestId("local-video-reopen")).toBeNull();
  });

  it("handle đã lưu: Mở lại được cấp quyền → gọi onFile", async () => {
    setPicker(vi.fn());
    const file = new File(["x"], "old.mp4", { type: "video/mp4" });
    const handle = { name: "old.mp4", requestPermission: async () => "granted", getFile: async () => file } as unknown as FileSystemFileHandle;
    store.set("l4", handle);
    const onFile = vi.fn();
    render(<LocalVideoSource lesson={{ ...lesson, id: "l4" }} onFile={onFile} />);
    fireEvent.click(await screen.findByTestId("local-video-reopen"));
    await waitFor(() => expect(onFile).toHaveBeenCalledWith(file));
  });
});
