import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vingo/shared"],
  // Cho phép build production song song dev server (dev dùng `.next`) để chạy e2e PWA:
  // `NEXT_DIST_DIR=.next-e2e pnpm --filter web build` rồi `next start` cùng biến này.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
