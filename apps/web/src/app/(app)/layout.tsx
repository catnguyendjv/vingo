import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">Vingo</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dictionary">単語帳 Từ điển</Link>
          <form action="/auth/signout" method="post"><button className="text-gray-500">Đăng xuất</button></form>
        </nav>
      </header>
      {children}
    </div>
  );
}
