import { describe, expect, it } from "vitest";
import { State } from "ts-fsrs";
import type { CardPatch, CardRow } from "./types";
import {
  GRADES, applyPatch, badgeCount, buildQueue, fromFsrsCard, patchOf, scheduleOptions, shouldRequeue, toFsrsCard,
} from "./srs";

const now = new Date("2026-09-08T09:00:00Z");
const base: CardRow = {
  id: "c1", lang: "ja", term: "決済", reading: "けっさい", meaning: "thanh toán",
  due_at: "2026-09-08T08:00:00Z", stability: null, difficulty: null, scheduled_days: null, learning_steps: null,
  reps: 0, lapses: 0, state: "New", last_review_at: null, created_at: "2026-09-07T00:00:00Z",
};

describe("toFsrsCard / fromFsrsCard", () => {
  it("New: null → 0, elapsed_days = 0, không có last_review", () => {
    const c = toFsrsCard(base, now);
    expect(c.state).toBe(State.New);
    expect(c.stability).toBe(0);
    expect(c.elapsed_days).toBe(0);
    expect(c.last_review).toBeUndefined();
  });
  it("Review: elapsed_days suy từ last_review_at", () => {
    const c = toFsrsCard({ ...base, state: "Review", stability: 5, difficulty: 6, last_review_at: "2026-09-05T09:00:00Z" }, now);
    expect(c.state).toBe(State.Review);
    expect(c.elapsed_days).toBe(3);
  });
  it("round-trip giữ state chuỗi và ISO", () => {
    const p = fromFsrsCard(toFsrsCard({ ...base, state: "Learning", last_review_at: "2026-09-08T08:30:00Z" }, now));
    expect(p.state).toBe("Learning");
    expect(p.due_at).toBe("2026-09-08T08:00:00.000Z");
    expect(p.last_review_at).toBe("2026-09-08T08:30:00.000Z");
  });
  it("patchOf là snapshot đủ cột", () => {
    expect(Object.keys(patchOf(base)).sort()).toEqual(
      ["difficulty", "due_at", "lapses", "last_review_at", "learning_steps", "reps", "scheduled_days", "stability", "state"],
    );
  });
});

describe("scheduleOptions", () => {
  it("4 lựa chọn Again..Easy, due không giảm, log.state = 0 cho thẻ New", () => {
    const o = scheduleOptions(base, now);
    expect(o.map((x) => x.rating)).toEqual([1, 2, 3, 4]);
    expect(o.map((x) => x.label)).toEqual(GRADES.map((g) => g.label));
    for (let i = 1; i < 4; i++) expect(o[i].dueAt.getTime()).toBeGreaterThanOrEqual(o[i - 1].dueAt.getTime());
    expect(o[2].log.state).toBe(0);
    expect(typeof o[2].log.review).toBe("string");
    expect(o[2].patch.reps).toBe(1);
    expect(o[2].patch.state).not.toBe("New");
    expect(o[2].intervalLabel.length).toBeGreaterThan(0);
  });
  it("thẻ Review đã ổn định: Good cho hạn xa hơn Again", () => {
    const row: CardRow = { ...base, state: "Review", stability: 10, difficulty: 5, reps: 3, last_review_at: "2026-08-29T09:00:00Z", due_at: "2026-09-08T08:00:00Z" };
    const o = scheduleOptions(row, now);
    expect(o[2].dueAt.getTime()).toBeGreaterThan(o[0].dueAt.getTime());
    expect(o[0].patch.lapses).toBe(1);
  });
});

describe("queue", () => {
  const due = (id: string, due_at: string): CardRow => ({ ...base, id, state: "Review", due_at });
  const fresh = (id: string, created_at: string): CardRow => ({ ...base, id, created_at });
  it("buildQueue: due theo due_at rồi New theo created_at (chấp nhận +00:00 và Z)", () => {
    const q = buildQueue([
      fresh("n2", "2026-09-02T00:00:00+00:00"), due("d2", "2026-09-08T07:00:00Z"),
      fresh("n1", "2026-09-01T00:00:00Z"), due("d1", "2026-09-08T06:00:00+00:00"),
    ]);
    expect(q.map((x) => x.id)).toEqual(["d1", "d2", "n1", "n2"]);
  });
  it("shouldRequeue: dưới 15 phút → true", () => {
    const p = (dueAt: string): CardPatch => ({ ...patchOf(base), due_at: dueAt });
    expect(shouldRequeue(p("2026-09-08T09:10:00Z"), now)).toBe(true);
    expect(shouldRequeue(p("2026-09-08T09:15:00Z"), now)).toBe(false);
  });
  it("applyPatch ghi đè cột lịch, giữ term", () => {
    const r = applyPatch(base, { ...patchOf(base), state: "Learning", reps: 1 });
    expect(r.state).toBe("Learning");
    expect(r.reps).toBe(1);
    expect(r.term).toBe("決済");
  });
  it("badgeCount = due + New còn được học", () => {
    expect(badgeCount({ due: 3, new_available: 50, new_last_24h: 5, next_due_at: null })).toBe(18);
    expect(badgeCount({ due: 0, new_available: 2, new_last_24h: 30, next_due_at: null })).toBe(0);
  });
});
