// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShareButton } from "./ShareButton";

// jsdom chưa hiện thực showModal/close của <dialog>.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
type L = Parameters<typeof ShareButton>[0]["lesson"];
const zoom: L = { source_type: "zoom", status: "ready", video_provider: "storage" };
const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled;

afterEach(cleanup);

describe("ShareButton", () => {
  it("zoom: cần tick xác nhận mới bật Chia sẻ", () => {
    const onChange = vi.fn();
    render(<ShareButton lesson={zoom} visibility="private" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    expect(screen.getByText("Chia sẻ bản ghi họp?")).toBeTruthy();
    const confirm = screen.getByRole("button", { name: /Chia sẻ lên cộng đồng/ });
    expect(isDisabled(confirm)).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Tôi đã xác nhận/ }));
    fireEvent.click(confirm);
    expect(onChange).toHaveBeenCalledWith("community");
  });
  it("youtube: xác nhận thường, không checkbox; local có dòng cảnh báo file", () => {
    const onChange = vi.fn();
    render(<ShareButton lesson={{ ...zoom, source_type: "youtube", video_provider: "local" }} visibility="private" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    expect(screen.getByText("Chia sẻ lên cộng đồng?")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/tự có file video/)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: /Chia sẻ lên cộng đồng/ });
    expect(isDisabled(confirm)).toBe(false);
    fireEvent.click(confirm);
    expect(onChange).toHaveBeenCalledWith("community");
  });
  it("đang community → bấm là ngừng chia sẻ, không dialog", () => {
    const onChange = vi.fn();
    render(<ShareButton lesson={zoom} visibility="community" onChange={onChange} />);
    const btn = screen.getByRole("button", { name: "Đang chia sẻ" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith("private");
    expect(screen.getByTestId("share-dialog").hasAttribute("open")).toBe(false);
  });
  it("bài chưa ready: disabled", () => {
    render(<ShareButton lesson={{ ...zoom, status: "draft" }} visibility="private" onChange={vi.fn()} />);
    expect(isDisabled(screen.getByRole("button", { name: "Chia sẻ" }))).toBe(true);
  });
});
