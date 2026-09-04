import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { SettingsView, type GrantRow } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const { data: grants } = await supabase
    .from("mcp_grants")
    .select("id, device_label, created_at, last_used_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (
    <main>
      <h1 className="mb-4 text-[22px] font-bold tracking-[-0.02em]">Cài đặt</h1>
      <SettingsView
        userId={user.id}
        displayName={profile?.display_name ?? ""}
        grants={(grants ?? []) as GrantRow[]}
      />
    </main>
  );
}
