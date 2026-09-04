import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Zen_Kaku_Gothic_New } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

// Font JP nặng: không preload, trình duyệt tải khi gặp glyph (spec 2.2).
const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  variable: "--font-zen-kaku",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Vingo",
  description: "Học ngoại ngữ từ video",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6F0" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1714" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="vi" data-theme={theme ?? undefined} className={`${beVietnam.variable} ${zenKaku.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
