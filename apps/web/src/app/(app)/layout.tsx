import { AppHeader } from "@/components/layout/AppHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-ink">
      <AppHeader />
      <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}
