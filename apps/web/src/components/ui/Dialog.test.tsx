// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Dialog } from "./Dialog";

// jsdom chưa hiện thực showModal/close của <dialog> → mock để đổi attribute `open`.
HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });

afterEach(cleanup);

describe("Dialog", () => {
  it("mở bằng showModal, đóng khi cancel", () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="Tiêu đề"><p>nội dung</p></Dialog>);
    const dlg = screen.getByRole("dialog");
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(screen.getByText("Tiêu đề")).toBeTruthy();
    expect(dlg.getAttribute("aria-labelledby")).toBe(screen.getByText("Tiêu đề").id);
    fireEvent(dlg, new Event("cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("click backdrop (chính <dialog>) gọi onClose, click nội dung thì không", () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="T" footer={<button>OK</button>}><p>nội dung</p></Dialog>);
    fireEvent.click(screen.getByText("nội dung"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "OK" })).toBeTruthy();
  });

  it("open=false → gọi close() khi đang mở", () => {
    const { rerender } = render(<Dialog open onClose={() => {}} title="T"><p>x</p></Dialog>);
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    rerender(<Dialog open={false} onClose={() => {}} title="T"><p>x</p></Dialog>);
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });
});
