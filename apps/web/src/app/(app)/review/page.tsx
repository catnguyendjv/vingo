import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ReviewSession } from "@/components/review/ReviewSession";
import type { QueueRow, ReviewStats } from "@/lib/types";

const EMPTY_STATS: ReviewStats = { due: 0, new_available: 0, new_last_24h: 0, next_due_at: null };

export default async function ReviewPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: queue }, { data: stats }, { count }] = await Promise.all([
    supabase.rpc("review_queue"),
    supabase.rpc("review_stats"),
    supabase.from("review_cards").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  return (
    <ReviewSession
      initialQueue={(queue ?? []) as QueueRow[]}
      stats={(stats as ReviewStats[] | null)?.[0] ?? EMPTY_STATS}
      hasAnyCard={(count ?? 0) > 0}
    />
  );
}
