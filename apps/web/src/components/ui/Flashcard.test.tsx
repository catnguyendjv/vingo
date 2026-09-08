// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Flashcard } from "./Flashcard";

function mockHover(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

const base = { term: "採用状況", reading: "さいようじょうきょう", meaning: "tình hình tuyển dụng", known: false };

afterEach(cleanup);

describe("Flashcard", () => {
  it("hiện term, cách đọc và nghĩa", () => {
    mockHover(true);
    render(<Flashcard {...base} onToggleKnown={() => {}} />);
    expect(screen.getByText("採用状況")).toBeTruthy();
    expect(screen.getAllByText("さいようじょうきょう").length).toBeGreaterThan(0);
    expect(screen.getByText("tình hình tuyển dụng")).toBeTruthy();
    expect(screen.getByTestId("flashcard").getAttribute("data-known")).toBe("false");
  });

  describe("desktop (hover: hover)", () => {
    beforeEach(() => mockHover(true));
    it("click thẻ → onToggleKnown, không lật", () => {
      const spy = vi.fn();
      render(<Flashcard {...base} onToggleKnown={spy} />);
      fireEvent.click(screen.getByRole("button", { name: "採用状況: đánh dấu đã thuộc" }));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("flashcard").classList.contains("fc-flipped")).toBe(false);
    });
  });

  describe("mobile (hover: none)", () => {
    beforeEach(() => mockHover(false));
    it("chạm thẻ → lật, không đánh dấu; nút mặt sau → đánh dấu rồi đóng", () => {
      const spy = vi.fn();
      render(<Flashcard {...base} onToggleKnown={spy} />);
      const card = screen.getByTestId("flashcard");
      fireEvent.click(screen.getByRole("button", { name: "採用状況: đánh dấu đã thuộc" }));
      expect(card.classList.contains("fc-flipped")).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "✓ Đã thuộc" }));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(card.classList.contains("fc-flipped")).toBe(false);
    });

    it("chạm nút mặt sau → thẻ đóng và không còn focus-within", () => {
      render(<Flashcard {...base} onToggleKnown={() => {}} />);
      const card = screen.getByTestId("flashcard");
      fireEvent.click(screen.getByRole("button", { name: "採用状況: đánh dấu đã thuộc" }));
      const backButton = screen.getByRole("button", { name: "✓ Đã thuộc" });
      fireEvent.focus(backButton);
      fireEvent.click(backButton);
      expect(card.classList.contains("fc-flipped")).toBe(false);
      expect(card.querySelector(".fc-back")?.getAttribute("aria-hidden")).toBe("true");
      expect(card.contains(document.activeElement)).toBe(false);
    });
  });

  it("known → gạch ngang, aria-label đổi, data-known=true", () => {
    mockHover(true);
    render(<Flashcard {...base} known onToggleKnown={() => {}} />);
    expect(screen.getByRole("button", { name: "採用状況: bỏ đánh dấu đã thuộc" })).toBeTruthy();
    expect(screen.getByTestId("flashcard").getAttribute("data-known")).toBe("true");
    expect(screen.getByText("採用状況").className).toContain("line-through");
  });

  it("editable → nút xoá gọi onRemove, không gọi onToggleKnown", () => {
    mockHover(true);
    const toggle = vi.fn(); const remove = vi.fn();
    render(<Flashcard {...base} editable onToggleKnown={toggle} onRemove={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "Xoá từ 採用状況" }));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(toggle).not.toHaveBeenCalled();
  });

  it("mobile: nút mặt sau không focus được khi chưa lật", () => {
    mockHover(false);
    render(<Flashcard {...base} onToggleKnown={() => {}} />);
    const backButton = screen.getByRole("button", { name: "✓ Đã thuộc", hidden: true });
    expect(backButton.getAttribute("tabindex")).toBe("-1");
    fireEvent.click(screen.getByRole("button", { name: "採用状況: đánh dấu đã thuộc" }));
    expect(backButton.getAttribute("tabindex")).toBe("0");
  });

  it("focus vào mặt trước → mặt sau không còn aria-hidden", () => {
    mockHover(true);
    const { container } = render(<Flashcard {...base} onToggleKnown={() => {}} />);
    const frontButton = screen.getByRole("button", { name: "採用状況: đánh dấu đã thuộc" });
    const back = container.querySelector(".fc-back") as HTMLElement;
    fireEvent.focus(frontButton);
    expect(back.getAttribute("aria-hidden")).toBe("false");
    fireEvent.blur(frontButton, { relatedTarget: null });
    expect(back.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("SRS enroll", () => {
  beforeEach(() => mockHover(false));
  it("mặt sau có nút Ôn tập → onEnroll; inReview → chip Đang ôn", () => {
    const enroll = vi.fn();
    const { rerender } = render(<Flashcard {...base} onToggleKnown={() => {}} onEnroll={enroll} />);
    fireEvent.click(screen.getByRole("button", { name: "採用状況: đánh dấu đã thuộc" }));
    fireEvent.click(screen.getByTestId("flashcard-enroll"));
    expect(enroll).toHaveBeenCalledTimes(1);
    rerender(<Flashcard {...base} onToggleKnown={() => {}} onEnroll={enroll} inReview />);
    expect(screen.queryByTestId("flashcard-enroll")).toBeNull();
    expect(screen.getByText("Đang ôn")).toBeTruthy();
  });
  it("không có onEnroll → không có nút", () => {
    render(<Flashcard {...base} onToggleKnown={() => {}} />);
    expect(screen.queryByTestId("flashcard-enroll")).toBeNull();
  });
});
