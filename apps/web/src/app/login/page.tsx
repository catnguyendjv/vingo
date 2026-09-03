import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Vingo</h1>
      <p className="text-sm text-gray-500">Đăng nhập bằng tài khoản được mời.</p>
      {error && <p className="text-sm text-red-600">Sai email hoặc mật khẩu.</p>}
      <form action={login} className="flex flex-col gap-3">
        <input name="email" type="email" required placeholder="Email" className="rounded border p-2" />
        <input name="password" type="password" required placeholder="Mật khẩu" className="rounded border p-2" />
        <button className="rounded bg-black p-2 text-white">Đăng nhập</button>
      </form>
    </main>
  );
}
