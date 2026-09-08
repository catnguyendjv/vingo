// Trang fallback khi mất mạng (spec P2 §5.2) — SW precache lúc install. Tĩnh, không gọi Supabase;
// middleware bỏ qua route này để chưa đăng nhập cũng không bị redirect (SW không cache được redirect).
// force-static → cookies() trong root layout rỗng: trang này theo theme hệ thống, chấp nhận.
import { Icon } from "@/components/ui/Icon";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-page px-6 text-center text-ink">
      <div className="flex flex-col items-center gap-3">
        <Icon name="video-off" className="size-10 text-muted" />
        <h1 className="text-xl font-bold">Không có kết nối</h1>
        <p className="text-sm text-muted">Vingo cần mạng để tải bài và lưu tiến độ. Kiểm tra kết nối rồi thử lại.</p>
        {/* Thẻ <a> thuần: không cần JS client; offline thì SW lại trả trang này. */}
        <a
          href="/"
          className="mt-2 inline-flex min-h-[40px] items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
        >
          Thử lại
        </a>
      </div>
    </main>
  );
}
