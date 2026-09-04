import type { SupabaseClient } from "@supabase/supabase-js";

// Hợp đồng của service layer: mọi business function nhận context thuần này.
// `supabase` PHẢI là client chạy dưới danh nghĩa user (JWT user → RLS thật),
// không phải service role. userId trùng sub của JWT — dùng cho các so khớp owner.
export type CoreContext = { userId: string; supabase: SupabaseClient };
