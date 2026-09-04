import { Router, urlencoded } from "express";
import { clientsStore, consumePairingCode, issueAuthCode } from "./store.js";

export const loginRouter = Router();

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function page(
  p: { client_id: string; redirect_uri: string; code_challenge: string; state?: string },
  error?: string,
): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kết nối Vingo</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; display: grid; min-height: 100vh;
    place-items: center; background: #faf6f0; color: #2a2320; }
  @media (prefers-color-scheme: dark) { body { background: #1c1714; color: #ede6df; } }
  .card { width: min(420px, 92vw); padding: 28px; border-radius: 16px; background: #fff;
    box-shadow: 0 12px 40px -18px rgba(0,0,0,.4); }
  @media (prefers-color-scheme: dark) { .card { background: #2a2320; } }
  h1 { font-size: 20px; margin: 0 0 6px; }
  p.sub { margin: 0 0 20px; opacity: .7; }
  label { display: block; font-weight: 600; margin-bottom: 8px; }
  input[name=pairing_code] { width: 100%; box-sizing: border-box; padding: 14px 16px; font-size: 22px;
    letter-spacing: 6px; text-align: center; text-transform: uppercase; border-radius: 12px;
    border: 1px solid #d8cfc4; background: transparent; color: inherit; }
  button { width: 100%; margin-top: 16px; padding: 14px; font-size: 16px; font-weight: 700; color: #fff;
    background: #d9663f; border: 0; border-radius: 12px; cursor: pointer; }
  .err { margin: 0 0 16px; padding: 10px 14px; border-radius: 10px; background: #fbe4dd; color: #a3341a; }
  @media (prefers-color-scheme: dark) { .err { background: #40201a; color: #f0a58f; } }
</style></head><body>
<form class="card" method="post" action="/login">
  <h1>Kết nối Claude Code với Vingo</h1>
  <p class="sub">Dán mã ghép nối 8 ký tự từ trang Cài đặt của Vingo.</p>
  ${error ? `<p class="err">${esc(error)}</p>` : ""}
  <input type="hidden" name="client_id" value="${esc(p.client_id)}">
  <input type="hidden" name="redirect_uri" value="${esc(p.redirect_uri)}">
  <input type="hidden" name="code_challenge" value="${esc(p.code_challenge)}">
  <input type="hidden" name="state" value="${esc(p.state ?? "")}">
  <label for="pairing_code">Mã ghép nối</label>
  <input id="pairing_code" name="pairing_code" autocomplete="off" autocapitalize="characters"
    spellcheck="false" maxlength="8" placeholder="ABCD2345" autofocus required>
  <button type="submit">Kết nối</button>
</form></body></html>`;
}

function q(req: { query: Record<string, unknown> }) {
  return {
    client_id: String(req.query.client_id ?? ""),
    redirect_uri: String(req.query.redirect_uri ?? ""),
    code_challenge: String(req.query.code_challenge ?? ""),
    state: req.query.state ? String(req.query.state) : undefined,
  };
}

loginRouter.get("/login", (req, res) => {
  const p = q(req as never);
  if (!p.client_id || !p.redirect_uri || !p.code_challenge) {
    res.status(400).type("html").send(page(p, "Thiếu tham số uỷ quyền. Hãy bắt đầu lại từ Claude Code."));
    return;
  }
  res.type("html").send(page(p));
});

loginRouter.post("/login", urlencoded({ extended: false }), async (req, res) => {
  const b = req.body as Record<string, string>;
  const p = {
    client_id: b.client_id ?? "",
    redirect_uri: b.redirect_uri ?? "",
    code_challenge: b.code_challenge ?? "",
    state: b.state || undefined,
  };
  if (!p.client_id || !p.redirect_uri || !p.code_challenge) {
    res.status(400).type("html").send(page(p, "Thiếu tham số uỷ quyền."));
    return;
  }

  // Chống open-redirect: redirect_uri phải nằm trong redirect_uris đã đăng ký của client.
  const client = await clientsStore.getClient(p.client_id);
  if (!client || !client.redirect_uris.includes(p.redirect_uri)) {
    res.status(400).type("html").send(page(p, "Client hoặc redirect_uri không hợp lệ."));
    return;
  }

  const userId = await consumePairingCode(b.pairing_code ?? "");
  if (!userId) {
    res.status(400).type("html").send(page(p, "Mã không đúng, đã hết hạn hoặc đã dùng. Tạo mã mới trong Cài đặt."));
    return;
  }

  const code = issueAuthCode({
    clientId: p.client_id,
    userId,
    codeChallenge: p.code_challenge,
    redirectUri: p.redirect_uri,
  });
  const out = new URLSearchParams({ code });
  if (p.state) out.set("state", p.state);
  res.redirect(`${p.redirect_uri}?${out.toString()}`);
});
