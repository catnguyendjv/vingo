import { login } from "./actions";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-page p-6 text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_10%_0%,var(--accent-soft),transparent_70%)] opacity-70"
      />
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="relative flex w-full max-w-[400px] flex-col gap-5 rounded-xl border border-line bg-surface p-8 shadow-card">
        <div className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.02em]">
          <span className="grid size-[30px] place-items-center rounded-sm bg-accent text-accent-fg">
            <Icon name="play" className="size-4" />
          </span>
          Vingo
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Đăng nhập</h1>
          <p className="mt-1 text-sm text-muted">Đăng nhập bằng tài khoản được mời.</p>
          {error && <p className="mt-2 text-sm font-medium text-danger">Sai email hoặc mật khẩu.</p>}
        </div>
        <form action={login} className="flex flex-col gap-3">
          <Input name="email" type="email" required placeholder="Email" autoComplete="email" icon="mail" aria-label="Email" />
          <Input name="password" type="password" required placeholder="Mật khẩu" autoComplete="current-password" icon="lock" aria-label="Mật khẩu" />
          <Button type="submit" variant="primary" className="mt-1 h-[46px] w-full justify-center">Đăng nhập</Button>
        </form>
        <p className="text-center text-xs text-muted">
          Học tiếng Nhật từ video họp · <span lang="ja" className="font-jp">日本語学習版</span>
        </p>
      </div>
    </main>
  );
}
