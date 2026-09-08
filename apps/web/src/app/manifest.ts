import type { MetadataRoute } from "next";

// PWA manifest (P1 §7). Không service worker (P2). theme/background theo design token light.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vingo — Học ngoại ngữ từ video",
    short_name: "Vingo",
    description: "Học ngoại ngữ từ video: phụ đề 2 ngôn ngữ sync theo câu + từ vựng + từ điển cá nhân.",
    lang: "vi",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#FAF6F0",
    theme_color: "#FAF6F0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
