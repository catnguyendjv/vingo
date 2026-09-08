// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { checkMatch, forgetHandle, loadHandle, saveHandle, supportsFileHandles } from "./local-video";

describe("checkMatch", () => {
  const lesson = { duration_sec: 2617, video_size_bytes: 1000 };
  it("khớp khi lệch duration ≤ 2s và size bằng", () => {
    expect(checkMatch({ size: 1000 }, 2618.4, lesson)).toEqual({ ok: true, reasons: [] });
  });
  it("cảnh báo khi duration lệch > 2s", () => {
    const r = checkMatch({ size: 1000 }, 2500, lesson);
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/thời lượng/);
  });
  it("cảnh báo khi size khác", () => {
    expect(checkMatch({ size: 999 }, 2617, lesson).reasons[0]).toMatch(/kích cỡ/);
  });
  it("bỏ kiểm tra trường lesson không có", () => {
    expect(checkMatch({ size: 5 }, 10, { duration_sec: null, video_size_bytes: null }).ok).toBe(true);
    expect(checkMatch({ size: 5 }, null, lesson).reasons).toEqual(["kích cỡ file khác bản gốc"]);
  });
});

describe("supportsFileHandles", () => {
  it("false khi không có showOpenFilePicker", () => { expect(supportsFileHandles({} as Window)).toBe(false); });
  it("true khi có", () => { expect(supportsFileHandles({ showOpenFilePicker: () => {} } as unknown as Window)).toBe(true); });
});

describe("handle store", () => {
  it("save → load → forget", async () => {
    const fake = { name: "a.mp4" } as unknown as FileSystemFileHandle;
    await saveHandle("lesson-1", fake);
    expect(await loadHandle("lesson-1")).toEqual(fake);
    await forgetHandle("lesson-1");
    expect(await loadHandle("lesson-1")).toBeNull();
  });
});
