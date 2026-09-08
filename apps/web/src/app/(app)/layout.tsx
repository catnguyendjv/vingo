import { AppHeader } from "@/components/layout/AppHeader";
import { createServerSupabase } from "@/lib/supabase/server";
import { badgeCount } from "@/lib/srs";
import type { ReviewStats } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Badge "Ôn tập" tính mỗi request (không realtime). Chưa đăng nhập / RPC lỗi → 0.
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("review_stats");
  const stats = (data as ReviewStats[] | null)?.[0];
  const reviewDue = stats ? badgeCount(stats) : 0;
  return (
    <div className="group/app min-h-screen bg-page text-ink">
      <AppHeader reviewDue={reviewDue} />
      <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 land:py-0">{children}</div>
    </div>
  );
}
