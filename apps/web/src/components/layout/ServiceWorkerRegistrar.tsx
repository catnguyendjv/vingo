"use client";
// Đăng ký service worker `public/sw.js` — chỉ production (spec P2 §5.3); dev không đăng ký để không cache
// bundle turbopack. Origin Supabase truyền qua query để SW bỏ qua các request đó. Khi có worker mới
// `installed` mà trang đang được controller cũ điều khiển → toast "Có bản mới", không tự reload giữa lúc học.
import { useEffect, useState } from "react";

export function ServiceWorkerRegistrar() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const url = `/sw.js?supabase=${encodeURIComponent(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")}`;
    let onVis: (() => void) | undefined;
    navigator.serviceWorker
      .register(url)
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
          });
        });
        // Quay lại tab → kiểm tra bản mới (điện thoại giữ tab rất lâu).
        onVis = () => {
          if (document.visibilityState === "visible") void reg.update();
        };
        document.addEventListener("visibilitychange", onVis);
      })
      .catch(() => {
        /* SW không bắt buộc — app vẫn chạy bình thường khi đăng ký thất bại. */
      });
    return () => {
      if (onVis) document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!updateReady) return null;
  return (
    <div
      role="status"
      data-testid="sw-update"
      className="fixed bottom-[96px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm text-page shadow-card lg:bottom-6"
    >
      Có bản mới
      <button type="button" className="font-semibold underline" onClick={() => location.reload()}>
        Tải lại
      </button>
    </div>
  );
}
