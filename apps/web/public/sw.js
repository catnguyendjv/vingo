// Vingo service worker — viết tay, không build step (spec P2 §5, quyết định P2-6: không dùng serwist vì
// không hỗ trợ Turbopack). ĐỔI `VERSION` MỖI LẦN SỬA FILE NÀY để activate xoá cache cũ.
//
// Chiến lược:
// - navigate (cùng origin): network-first, timeout 4s → bản cache của URL đó → /offline.
// - /_next/static/**, /icon-*.png, fonts.gstatic.com: cache-first (tên có hash / bất biến).
// - Bỏ qua hoàn toàn (để trình duyệt tự xử lý): không phải GET, có header Range (video), Supabase
//   (origin nhận qua query `sw.js?supabase=`), /auth/*, YouTube/ytimg, cross-origin còn lại.
// Không offline video, không background sync, không push.
const VERSION = "v1";
const CACHE = `vingo-${VERSION}`;
const PRECACHE = ["/offline", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];
const SUPABASE = new URL(self.location.href).searchParams.get("supabase") || "";
const NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (u) =>
  u.origin === self.location.origin && (u.pathname.startsWith("/_next/static/") || /^\/icon-\d+\.png$/.test(u.pathname));
const isFont = (u) => u.hostname === "fonts.gstatic.com";
const skip = (req, u) =>
  req.method !== "GET" ||
  req.headers.has("range") ||
  (SUPABASE && u.href.startsWith(SUPABASE)) ||
  u.pathname.startsWith("/auth/") ||
  u.hostname.endsWith("ytimg.com") ||
  u.hostname.endsWith("youtube.com") ||
  (u.origin !== self.location.origin && !isFont(u));

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function navigate(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), NAV_TIMEOUT_MS)),
    ]);
    // Redirect (vd. chưa đăng nhập → /login) trả về opaqueredirect, ok=false → không cache, trình duyệt tự theo.
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await cache.match("/offline"));
  }
}

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (skip(e.request, u)) return;
  if (e.request.mode === "navigate") {
    e.respondWith(navigate(e.request));
    return;
  }
  if (isStatic(u) || isFont(u)) e.respondWith(cacheFirst(e.request));
});
