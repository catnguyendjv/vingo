import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { serviceClient } from "../supabase.js";
import type { GrantIdentity, PendingAuthCode } from "../types.js";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const opaque = () => randomBytes(32).toString("base64url");

// ── DCR client registrations (persist vào oauth_clients, restart không mất) ──────────
export const clientsStore: OAuthRegisteredClientsStore = {
  async getClient(clientId) {
    const { data, error } = await serviceClient()
      .from("oauth_clients")
      .select("payload")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) throw new Error(`getClient: ${error.message}`);
    return (data?.payload as OAuthClientInformationFull | undefined) ?? undefined;
  },
  async registerClient(client) {
    // DCR mở: không whitelist redirect URI (Claude Code dùng http://localhost:<random>/callback).
    const full: OAuthClientInformationFull = {
      ...client,
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    const { error } = await serviceClient()
      .from("oauth_clients")
      .insert({ client_id: full.client_id, payload: full });
    if (error) throw new Error(`registerClient: ${error.message}`);
    return full;
  },
};

// ── Pending authorization codes (in-memory) ──────────────────────────────────────────
const pending = new Map<string, PendingAuthCode>();
const CODE_TTL_MS = 5 * 60 * 1000;

export function issueAuthCode(input: Omit<PendingAuthCode, "expiresAt">): string {
  const code = opaque();
  pending.set(code, { ...input, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

export function peekAuthCode(code: string): PendingAuthCode | undefined {
  const p = pending.get(code);
  if (!p) return undefined;
  if (p.expiresAt < Date.now()) {
    pending.delete(code);
    return undefined;
  }
  return p;
}

export function consumeAuthCode(code: string): PendingAuthCode | undefined {
  const p = peekAuthCode(code);
  if (p) pending.delete(code);
  return p;
}

// ── Grants / tokens (hash lưu mcp_grants) ─────────────────────────────────────────────
const ACCESS_TTL_MS = 60 * 60 * 1000; // 1h

export interface IssuedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function createGrant(input: {
  userId: string;
  clientId: string;
  deviceLabel?: string;
}): Promise<IssuedTokens> {
  const access = opaque();
  const refresh = opaque();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const { error } = await serviceClient().from("mcp_grants").insert({
    user_id: input.userId,
    client_id: input.clientId,
    device_label: input.deviceLabel ?? null,
    access_token_hash: sha256(access),
    refresh_token_hash: sha256(refresh),
    access_expires_at: accessExpiresAt.toISOString(),
    last_used_at: new Date().toISOString(),
  });
  if (error) throw new Error(`createGrant: ${error.message}`);
  return { access_token: access, refresh_token: refresh, expires_in: ACCESS_TTL_MS / 1000 };
}

export async function rotateGrant(
  refreshToken: string,
): Promise<(IssuedTokens & { userId: string; clientId: string }) | null> {
  const { data, error } = await serviceClient()
    .from("mcp_grants")
    .select("id, user_id, client_id, revoked_at")
    .eq("refresh_token_hash", sha256(refreshToken))
    .maybeSingle();
  if (error) throw new Error(`rotateGrant: ${error.message}`);
  if (!data || data.revoked_at) return null;

  const access = opaque();
  const refresh = opaque();
  const { error: upErr } = await serviceClient()
    .from("mcp_grants")
    .update({
      access_token_hash: sha256(access),
      refresh_token_hash: sha256(refresh),
      access_expires_at: new Date(Date.now() + ACCESS_TTL_MS).toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (upErr) throw new Error(`rotateGrant update: ${upErr.message}`);
  invalidateAccessCache();
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: ACCESS_TTL_MS / 1000,
    userId: data.user_id,
    clientId: data.client_id,
  };
}

// verifyAccessToken: tra mcp_grants theo hash, cache ≤60s → revoke từ web hết hiệu lực trong ≤60s.
const accessCache = new Map<string, { value: GrantIdentity | null; cachedAt: number }>();
const CACHE_MS = 60 * 1000;
const lastUsedWrite = new Map<string, number>();

function invalidateAccessCache() {
  accessCache.clear();
}

export async function verifyAccess(token: string): Promise<GrantIdentity | null> {
  const hash = sha256(token);
  const cached = accessCache.get(hash);
  if (cached && Date.now() - cached.cachedAt < CACHE_MS) return cached.value;

  const { data, error } = await serviceClient()
    .from("mcp_grants")
    .select("id, user_id, client_id, access_expires_at, revoked_at")
    .eq("access_token_hash", hash)
    .maybeSingle();
  if (error) throw new Error(`verifyAccess: ${error.message}`);

  let value: GrantIdentity | null = null;
  if (data && !data.revoked_at && data.access_expires_at) {
    const exp = new Date(data.access_expires_at).getTime();
    if (exp > Date.now()) {
      value = { grantId: data.id, userId: data.user_id, clientId: data.client_id, accessExpiresAt: exp };
    }
  }
  accessCache.set(hash, { value, cachedAt: Date.now() });

  // Cập nhật last_used_at, throttle 1 lần/phút/grant.
  if (value) {
    const last = lastUsedWrite.get(value.grantId) ?? 0;
    if (Date.now() - last > 60 * 1000) {
      lastUsedWrite.set(value.grantId, Date.now());
      void serviceClient()
        .from("mcp_grants")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", value.grantId);
    }
  }
  return value;
}

// Validate + consume pairing code (service role). Trả user_id nếu hợp lệ, null nếu sai/hết hạn/đã dùng.
export async function consumePairingCode(rawCode: string): Promise<string | null> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(code)) return null;
  const hash = sha256(code);
  const { data, error } = await serviceClient()
    .from("pairing_codes")
    .select("id, user_id, expires_at, consumed_at")
    .eq("code_hash", hash)
    .maybeSingle();
  if (error) throw new Error(`consumePairingCode: ${error.message}`);
  if (!data || data.consumed_at || new Date(data.expires_at).getTime() < Date.now()) return null;

  // One-time: chỉ consume nếu còn chưa consume (guard race).
  const { data: updated, error: upErr } = await serviceClient()
    .from("pairing_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("consumed_at", null)
    .select("id");
  if (upErr) throw new Error(`consumePairingCode update: ${upErr.message}`);
  if (!updated || updated.length === 0) return null; // ai đó vừa consume trước
  return data.user_id;
}

export async function revokeByToken(token: string): Promise<void> {
  const hash = sha256(token);
  await serviceClient()
    .from("mcp_grants")
    .update({ revoked_at: new Date().toISOString() })
    .or(`access_token_hash.eq.${hash},refresh_token_hash.eq.${hash}`);
  invalidateAccessCache();
}
