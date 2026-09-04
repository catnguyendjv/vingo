import { describe, expect, it } from "vitest";
import { THEME_COOKIE, parseTheme } from "./theme";

describe("theme", () => {
  it("tên cookie cố định", () => expect(THEME_COOKIE).toBe("vingo-theme"));
  it("chỉ nhận light/dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("auto")).toBeNull();
    expect(parseTheme("")).toBeNull();
    expect(parseTheme(undefined)).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });
});
