// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const rpc = vi.fn().mockResolvedValue({ data: [{ created: 1, reactivated: 0 }], error: null });
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc,
    from: () => ({
      delete: () => ({ match: vi.fn().mockResolvedValue({ error: null }) }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

import { DictionaryTable, type DictEntry } from "./DictionaryTable";

const entry = (term: string, x: Partial<DictEntry> = {}): DictEntry => ({
  lang: "ja", term, reading: "よみ", meaning: "nghĩa", occurrences: 1,
  lesson_ids: ["L1"], cue_ids: ["C1"], is_known: false, in_review: false, ...x,
});

afterEach(() => { cleanup(); rpc.mockClear(); });

describe("DictionaryTable — SRS", () => {
  it("từ đang ôn hiện chip; nút Ôn tập gọi enroll_cards với lesson/cue đầu tiên rồi đổi thành chip", async () => {
    render(<DictionaryTable entries={[entry("決済"), entry("確認", { in_review: true })]} userId="u" />);
    // Mỗi entry render 2 lần (bảng desktop + thẻ mobile) → đếm theo dòng bảng.
    const rowKakunin = screen.getByTestId("dict-table").querySelector('tr[data-term="確認"]')!;
    expect(rowKakunin.textContent).toContain("Đang ôn");
    const rowKessai = screen.getByTestId("dict-table").querySelector('tr[data-term="決済"]')!;
    fireEvent.click(rowKessai.querySelector('[data-testid="dict-enroll"]')!);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("enroll_cards", {
      items: [{ lang: "ja", term: "決済", reading: "よみ", meaning: "nghĩa", lesson_id: "L1", cue_id: "C1" }],
    }));
    await waitFor(() => expect(rowKessai.textContent).toContain("Đang ôn"));
  });

  it("enroll từ đã thuộc → bỏ đánh dấu đã thuộc trên UI", async () => {
    render(<DictionaryTable entries={[entry("決済", { is_known: true })]} userId="u" />);
    const row = screen.getByTestId("dict-table").querySelector('tr[data-term="決済"]')!;
    expect(row.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(row.querySelector('[data-testid="dict-enroll"]')!);
    await waitFor(() => expect(row.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("false"));
  });

  it("đánh dấu đã thuộc một từ đang ôn → bỏ chip Đang ôn (trigger DB suspend)", async () => {
    render(<DictionaryTable entries={[entry("確認", { in_review: true })]} userId="u" />);
    const row = screen.getByTestId("dict-table").querySelector('tr[data-term="確認"]')!;
    fireEvent.click(row.querySelector('[role="checkbox"]')!);
    await waitFor(() => expect(row.textContent).not.toContain("Đang ôn"));
  });
});
