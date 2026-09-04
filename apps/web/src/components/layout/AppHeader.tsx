import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AppHeader() {
  return (
    <header className="border-b border-line bg-page">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.02em]">
          <span className="grid size-[30px] place-items-center rounded-sm bg-accent text-accent-fg">
            <Icon name="play" className="size-4" />
          </span>
          Vingo
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link
            href="/dictionary"
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 font-medium transition-colors hover:bg-surface-2"
          >
            <Icon name="book" className="size-[18px]" />
            <span className="hidden sm:inline">
              <span lang="ja" className="font-jp text-muted">単語帳</span> Từ điển
            </span>
          </Link>
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Icon name="log-out" className="size-[18px]" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
