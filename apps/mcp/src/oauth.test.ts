import type { Server } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "./config.js";
import { createApp } from "./index.js";
import { mintUserJwt } from "./auth/jwt.js";
import { serviceClient } from "./supabase.js";
import { revokeByToken } from "./auth/store.js";

const base = config.baseUrl; // http://127.0.0.1:8799
const REDIRECT = "http://127.0.0.1:9999/callback";
const b64url = (b: Buffer) => b.toString("base64url");

let server: Server;
let userId: string;
let meta: { authorization_endpoint: string; token_endpoint: string; registration_endpoint: string };

function userSupabase(uid: string) {
  return createClient(config.supabaseUrl, config.anonKey, {
    global: { headers: { Authorization: `Bearer ${mintUserJwt(uid)}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function freshPairingCode(uid: string): Promise<string> {
  const { data, error } = await userSupabase(uid).rpc("create_pairing_code");
  if (error) throw new Error(error.message);
  return data as string;
}

async function registerClient(): Promise<string> {
  const res = await fetch(meta.registration_endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [REDIRECT],
      client_name: "Test Device",
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).client_id as string;
}

function pkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

// POST /login (form) → trả Location (redirect) hoặc status khi lỗi.
async function postLogin(fields: Record<string, string>) {
  return fetch(`${base}/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
    redirect: "manual",
  });
}

beforeAll(async () => {
  server = createApp().listen(8799);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const email = `oauth-${randomUUID()}@vingo.local`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: "devpass123",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  userId = data.user.id;
  meta = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
});

afterAll(async () => {
  await serviceClient().from("lessons").delete().eq("owner_id", userId);
  await serviceClient().auth.admin.deleteUser(userId);
  await new Promise<void>((r) => server.close(() => r()));
});

describe("OAuth 2.1 + pairing flow", () => {
  it("DCR → authorize → login (code thật) → token → whoami; revoke → 401", async () => {
    const clientId = await registerClient();
    const { verifier, challenge } = pkce();
    const state = randomUUID();

    // GET /authorize → 302 tới /login.
    const authUrl = new URL(meta.authorization_endpoint);
    authUrl.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      resource: `${base}/mcp`,
    }).toString();
    const authRes = await fetch(authUrl, { redirect: "manual" });
    expect(authRes.status).toBeGreaterThanOrEqual(300);
    expect(authRes.status).toBeLessThan(400);
    expect(authRes.headers.get("location")).toContain("/login");

    // POST /login với pairing code thật → 302 tới redirect_uri?code=...
    const code = await freshPairingCode(userId);
    const loginRes = await postLogin({
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      state,
      pairing_code: code,
    });
    expect(loginRes.status).toBe(302);
    const cb = new URL(loginRes.headers.get("location")!);
    expect(cb.searchParams.get("state")).toBe(state);
    const authCode = cb.searchParams.get("code")!;
    expect(authCode).toBeTruthy();

    // POST /token đổi access + refresh.
    const tokRes = await fetch(meta.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: authCode,
        redirect_uri: REDIRECT,
        client_id: clientId,
        code_verifier: verifier,
      }).toString(),
    });
    expect(tokRes.status).toBe(200);
    const tokens = await tokRes.json();
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();

    // Gọi whoami qua MCP client SDK với access token.
    const client = new Client({ name: "test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    });
    await client.connect(transport);

    // tools/list phải serialize được schema mọi tool (gồm create_lesson dùng lessonJsonSchema).
    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "whoami",
        "get_authoring_guide",
        "list_lessons",
        "get_known_words",
        "create_lesson",
        "ingest_video_from_url",
        "get_ingest_status",
        "request_video_upload",
        "finalize_lesson",
      ]),
    );

    const res = (await client.callTool({ name: "whoami", arguments: {} })) as {
      content: { text: string }[];
    };
    const who = JSON.parse(res.content[0].text);
    expect(who.user_id).toBe(userId);
    await client.close();

    // Revoke (mô phỏng web revoke) → token mới verify phải 401.
    await revokeByToken(tokens.access_token);
    const client2 = new Client({ name: "test2", version: "0.0.0" });
    const transport2 = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    });
    await expect(client2.connect(transport2)).rejects.toThrow();
  });

  it("mã sai / hết hạn / dùng lại đều bị từ chối", async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();
    const base402 = { client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, state: "s" };

    // Sai.
    const bad = await postLogin({ ...base402, pairing_code: "ZZZZ9999" });
    expect(bad.status).toBe(400);

    // Dùng lại: consume 1 lần rồi lặp lại.
    const code = await freshPairingCode(userId);
    const first = await postLogin({ ...base402, pairing_code: code });
    expect(first.status).toBe(302);
    const reuse = await postLogin({ ...base402, pairing_code: code });
    expect(reuse.status).toBe(400);

    // Hết hạn: tạo code rồi đẩy expires_at về quá khứ.
    const code2 = await freshPairingCode(userId);
    await serviceClient()
      .from("pairing_codes")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("code_hash", createHash("sha256").update(code2).digest("hex"));
    const expired = await postLogin({ ...base402, pairing_code: code2 });
    expect(expired.status).toBe(400);
  });
});
