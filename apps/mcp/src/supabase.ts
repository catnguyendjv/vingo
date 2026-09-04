import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CoreContext } from "@vingo/core";
import { config } from "./config.js";
import { mintUserJwt } from "./auth/jwt.js";

// Service role: CHỈ cho (a) validate pairing/token, (b) ký Storage, (c) janitor. Không cho dữ liệu user.
let _service: SupabaseClient | null = null;
export function serviceClient(): SupabaseClient {
  if (!_service) {
    _service = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _service;
}

// Client chạy dưới danh nghĩa user: anon key làm apikey (gateway) + user-JWT làm Bearer (role/RLS).
export function userClient(userId: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.anonKey, {
    global: { headers: { Authorization: `Bearer ${mintUserJwt(userId)}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function coreContext(userId: string): CoreContext {
  return { userId, supabase: userClient(userId) };
}
