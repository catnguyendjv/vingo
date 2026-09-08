import { describe, expect, it } from "vitest";
import { findActiveCueIndex, nextUndoneIndex, stepIndex } from "./cues";

const cues = [
  { id: "a", start_ms: 1000, end_ms: 2000 },
  { id: "b", start_ms: 3000, end_ms: 4000 },
  { id: "c", start_ms: 4000, end_ms: 6000 },
];

describe("findActiveCueIndex", () => {
  it("trước cue đầu → -1", () => expect(findActiveCueIndex(cues, 0)).toBe(-1));
  it("trong cue → index cue đó", () => expect(findActiveCueIndex(cues, 1500)).toBe(0));
  it("khoảng lặng giữa 2 cue → cue trước đó", () => expect(findActiveCueIndex(cues, 2500)).toBe(0));
  it("biên start_ms thuộc cue", () => expect(findActiveCueIndex(cues, 3000)).toBe(1));
  it("sau cue cuối → cue cuối", () => expect(findActiveCueIndex(cues, 99999)).toBe(2));
});

describe("nextUndoneIndex", () => {
  it("chưa học gì → 0", () => expect(nextUndoneIndex(cues, new Set())).toBe(0));
  it("học cue đầu → 1", () => expect(nextUndoneIndex(cues, new Set(["a"]))).toBe(1));
  it("học hết → -1", () => expect(nextUndoneIndex(cues, new Set(["a", "b", "c"]))).toBe(-1));
});

describe("stepIndex", () => {
  it("chưa có câu active → fallback", () => expect(stepIndex(-1, 1, 5, 2)).toBe(2));
  it("fallback -1 → 0", () => expect(stepIndex(-1, 1, 5, -1)).toBe(0));
  it("kẹp ở câu cuối", () => expect(stepIndex(4, 1, 5, 0)).toBe(4));
  it("kẹp ở câu đầu", () => expect(stepIndex(0, -1, 5, 0)).toBe(0));
  it("bước tới", () => expect(stepIndex(2, 1, 5, 0)).toBe(3));
  it("không có câu → -1", () => expect(stepIndex(0, 1, 0, 0)).toBe(-1));
});
