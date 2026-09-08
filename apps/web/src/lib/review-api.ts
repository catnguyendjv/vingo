import type { SupabaseClient } from "@supabase/supabase-js";
import type { CardPatch, EnrollItem } from "./types";

/** Lớp mỏng quanh 3 RPC SRS; inject được vào component để test không cần Supabase. */
export type ReviewApi = {
  review(cardId: string, rating: number, patch: CardPatch, log: Record<string, unknown>): Promise<void>;
  undo(cardId: string, patch: CardPatch): Promise<void>;
  enroll(items: EnrollItem[]): Promise<{ created: number; reactivated: number }>;
};

export function createReviewApi(supabase: SupabaseClient): ReviewApi {
  const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as T;
  };
  return {
    async review(cardId, rating, patch, log) {
      await call("review_card", { p_card_id: cardId, p_rating: rating, p_card: patch, p_log: log });
    },
    async undo(cardId, patch) {
      await call("undo_review", { p_card_id: cardId, p_card: patch });
    },
    async enroll(items) {
      const rows = await call<{ created: number; reactivated: number }[] | null>("enroll_cards", { items });
      return rows?.[0] ?? { created: 0, reactivated: 0 };
    },
  };
}
