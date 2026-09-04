import { expect, it } from "vitest";
import { getAuthoringGuide } from "./authoring.js";

it("getAuthoringGuide trả markdown canonical với các mục chính", () => {
  const guide = getAuthoringGuide();
  expect(guide).toContain("Schema lesson JSON");
  expect(guide).toContain("start_ms < end_ms");
  expect(guide).toContain("Chọn vocab");
  expect(guide).toContain("timestamp");
  // Cache: gọi lại trả cùng nội dung.
  expect(getAuthoringGuide()).toBe(guide);
});
