import { describe, expect, it } from "vitest";
import { lessonJsonSchema } from "./lesson.js";

const cue = (id: string, idx: number, start = idx * 1000) => ({
  id, idx, start_ms: start, end_ms: start + 900, text_source: `文${idx}`, text_target: `câu ${idx}`,
});
const U = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const valid = {
  id: U(1), title: "Bài test", source_type: "zoom", source_lang: "ja", target_lang: "vi",
  video_provider: "storage", video_ref: "video.mp4",
  cues: [cue(U(2), 1), cue(U(3), 2)],
  vocab: [{ id: U(4), cue_id: U(2), term: "決済", reading: "けっさい", meaning: "thanh toán" }],
};

describe("lessonJsonSchema", () => {
  it("chấp nhận lesson hợp lệ", () => {
    expect(lessonJsonSchema.parse(valid).cues).toHaveLength(2);
  });
  it("từ chối cue id trùng", () => {
    const bad = { ...valid, cues: [cue(U(2), 1), cue(U(2), 2)] };
    expect(() => lessonJsonSchema.parse(bad)).toThrow(/duplicate cue id/i);
  });
  it("từ chối idx trùng", () => {
    const bad = { ...valid, cues: [cue(U(2), 1), cue(U(3), 1, 5000)] };
    expect(() => lessonJsonSchema.parse(bad)).toThrow(/duplicate cue idx/i);
  });
  it("từ chối start_ms >= end_ms", () => {
    const bad = { ...valid, cues: [{ ...cue(U(2), 1), end_ms: 0 }] };
    expect(() => lessonJsonSchema.parse(bad)).toThrow(/start_ms/);
  });
  it("từ chối vocab trỏ cue không tồn tại", () => {
    const bad = { ...valid, vocab: [{ ...valid.vocab[0], cue_id: U(9) }] };
    expect(() => lessonJsonSchema.parse(bad)).toThrow(/unknown cue_id/i);
  });
  it("youtube không cần video file", () => {
    const yt = { ...valid, source_type: "youtube", video_provider: "youtube", video_ref: "dQw4w9WgXcQ", vocab: [] };
    expect(lessonJsonSchema.parse(yt).video_provider).toBe("youtube");
  });
});
