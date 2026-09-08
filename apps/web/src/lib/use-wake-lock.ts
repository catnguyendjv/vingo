// Giữ màn hình sáng khi đang phát video (spec P2 §6 M5). Không hỗ trợ API → bỏ qua.
"use client";
import { useEffect } from "react";

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) await sentinel.release();
      } catch {
        /* bị từ chối (pin yếu, tab ẩn) → bỏ qua */
      }
    };
    // Tab ẩn thì hệ tự release; hiện lại và vẫn đang phát → xin lại.
    const onVis = () => {
      if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release();
    };
  }, [active]);
}
