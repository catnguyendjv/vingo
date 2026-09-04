import jwt from "jsonwebtoken";
import { config } from "../config.js";

// Mint user-JWT ngắn hạn (HS256, ký bằng SUPABASE_JWT_SECRET) để supabase client chạy dưới RLS.
// Cache theo userId, tái dùng khi còn >60s để đỡ ký lại mỗi request.
const cache = new Map<string, { token: string; expSec: number }>();
const TTL_SEC = 600; // 10'

export function mintUserJwt(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const hit = cache.get(userId);
  if (hit && hit.expSec - now > 60) return hit.token;
  const token = jwt.sign(
    { sub: userId, role: "authenticated", aud: "authenticated" },
    config.jwtSecret,
    { expiresIn: TTL_SEC },
  );
  cache.set(userId, { token, expSec: now + TTL_SEC });
  return token;
}
