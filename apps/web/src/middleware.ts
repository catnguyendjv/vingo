import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}
export const config = {
  // Bỏ qua tài nguyên PWA: `/offline`, `sw.js`, manifest — SW precache lúc install (không cookie session) và
  // không cache được response redirect, nên các route này không được đẩy về /login (spec P2 §5).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|offline$|sw\\.js$|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg)$).*)"],
};
