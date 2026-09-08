import {
  dateDiffInDays, fsrs, generatorParameters, Rating, State,
  type Card, type Grade, type ReviewLog,
} from "ts-fsrs";
import type { CardPatch, CardRow, ReviewStats, StateName } from "./types";
import { formatInterval } from "./format";

/** Cap thẻ New trong cửa sổ 24 giờ trượt (spec P1.5 S-5). */
export const NEW_CAP = 20;
/** Sau khi chấm, thẻ có hạn mới cách hiện tại dưới mốc này thì quay lại cuối hàng đợi trong phiên. */
export const REQUEUE_WINDOW_MS = 15 * 60_000;

export type GradeValue = 1 | 2 | 3 | 4;
export const GRADES: readonly { rating: GradeValue; key: string; label: string }[] = [
  { rating: Rating.Again, key: "1", label: "Quên" },
  { rating: Rating.Hard, key: "2", label: "Khó" },
  { rating: Rating.Good, key: "3", label: "Được" },
  { rating: Rating.Easy, key: "4", label: "Dễ" },
];

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));
const stateOf = (s: StateName): State => State[s];
const nameOf = (s: State): StateName => State[s] as StateName;

/** Hàng DB → Card của ts-fsrs. `elapsed_days` không lưu trong schema nên suy ra từ last_review_at. */
export function toFsrsCard(row: CardRow, now: Date): Card {
  const last = row.last_review_at ? new Date(row.last_review_at) : undefined;
  const state = stateOf(row.state);
  return {
    due: new Date(row.due_at),
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    elapsed_days: state === State.New || !last ? 0 : Math.max(0, dateDiffInDays(last, now)),
    scheduled_days: row.scheduled_days ?? 0,
    learning_steps: row.learning_steps ?? 0,
    reps: row.reps,
    lapses: row.lapses,
    state,
    last_review: last,
  };
}

export function fromFsrsCard(card: Card): CardPatch {
  return {
    due_at: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: nameOf(card.state),
    last_review_at: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** Snapshot cột lịch hiện tại của hàng — dùng cho Undo. */
export function patchOf(row: CardRow): CardPatch {
  return {
    due_at: row.due_at,
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    scheduled_days: row.scheduled_days ?? 0,
    learning_steps: row.learning_steps ?? 0,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review_at: row.last_review_at,
  };
}

/** ReviewLog của lib với ngày ở dạng ISO — lưu nguyên vào review_logs.log (state số: 0 = New). */
export function serializeLog(log: ReviewLog): Record<string, unknown> {
  return { ...log, due: log.due.toISOString(), review: log.review.toISOString() };
}

export type ScheduleOption = {
  rating: GradeValue; key: string; label: string;
  patch: CardPatch; log: Record<string, unknown>; dueAt: Date; intervalLabel: string;
};

/** 4 lựa chọn Again/Hard/Good/Easy cho thẻ tại thời điểm `now`. */
export function scheduleOptions(row: CardRow, now: Date): ScheduleOption[] {
  const record = scheduler.repeat(toFsrsCard(row, now), now);
  return GRADES.map((g) => {
    const { card, log } = record[g.rating as Grade];
    return {
      rating: g.rating, key: g.key, label: g.label,
      patch: fromFsrsCard(card), log: serializeLog(log), dueAt: card.due,
      intervalLabel: formatInterval(card.due.getTime() - now.getTime()),
    };
  });
}

const ts = (s: string) => Date.parse(s);

/** Due (state ≠ New) theo due_at tăng dần, rồi New theo created_at. Server đã áp cap New. */
export function buildQueue<T extends CardRow>(rows: T[]): T[] {
  const due = rows.filter((r) => r.state !== "New").sort((a, b) => ts(a.due_at) - ts(b.due_at));
  const fresh = rows.filter((r) => r.state === "New").sort((a, b) => ts(a.created_at) - ts(b.created_at));
  return [...due, ...fresh];
}

export function applyPatch<T extends CardRow>(row: T, patch: CardPatch): T {
  return { ...row, ...patch };
}

export function shouldRequeue(patch: CardPatch, now: Date): boolean {
  return ts(patch.due_at) - now.getTime() < REQUEUE_WINDOW_MS;
}

/** Số hiện trên badge header: due + phần New còn được học trong 24h. */
export function badgeCount(s: ReviewStats): number {
  return s.due + Math.min(s.new_available, Math.max(0, NEW_CAP - s.new_last_24h));
}
