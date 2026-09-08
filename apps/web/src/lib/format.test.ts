import { describe, expect, it } from "vitest";
import { formatDuration, formatInterval, formatTimestamp, percent } from "./format";

describe("formatDuration", () => {
  it("dưới 1 giờ → m:ss", () => expect(formatDuration(2390)).toBe("39:50"));
  it("trên 1 giờ → h:mm:ss", () => expect(formatDuration(4324)).toBe("1:12:04"));
  it("0 → 0:00", () => expect(formatDuration(0)).toBe("0:00"));
  it("null/âm/NaN → null", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
  });
  it("làm tròn xuống giây lẻ", () => expect(formatDuration(65.9)).toBe("1:05"));
});

describe("formatTimestamp", () => {
  it("ms → m:ss", () => expect(formatTimestamp(3000)).toBe("0:03"));
  it("ms lớn → h:mm:ss", () => expect(formatTimestamp(3_723_000)).toBe("1:02:03"));
});

describe("percent", () => {
  it("total 0 → 0", () => expect(percent(5, 0)).toBe(0));
  it("làm tròn", () => expect(percent(37, 576)).toBe(6));
  it("không vượt 100", () => expect(percent(200, 100)).toBe(100));
  it("đủ → 100", () => expect(percent(140, 140)).toBe(100));
});

describe("formatInterval", () => {
  it("các mốc", () => {
    expect(formatInterval(30_000)).toBe("<1 phút");
    expect(formatInterval(10 * 60_000)).toBe("10 phút");
    expect(formatInterval(3 * 3_600_000)).toBe("3 giờ");
    expect(formatInterval(3 * 86_400_000)).toBe("3 ngày");
    expect(formatInterval(60 * 86_400_000)).toBe("2 tháng");
    expect(formatInterval(548 * 86_400_000)).toBe("1,5 năm");
    expect(formatInterval(-5)).toBe("<1 phút");
  });
});
