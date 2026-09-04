import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { request } from "undici";

export class SsrfError extends Error {}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// ── Phân loại IP (pure, unit-test đủ nhánh) ───────────────────────────────────────────
function v4Blocked(a: number, b: number): boolean {
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback 127/8
  if (a === 169 && b === 254) return true; // link-local + metadata 169.254/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a >= 224) return true; // multicast/reserved 224/4, 240/4, 255.255.255.255
  return false;
}

function parseV4(ip: string): [number, number] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1, 5).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return [parts[0], parts[1]];
}

function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  if (s.includes("%")) s = s.slice(0, s.indexOf("%")); // bỏ zone id
  // IPv4-mapped/embedded: xử lý đuôi v4 riêng.
  let tailV4: [number, number, number, number] | null = null;
  const v4m = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4m) {
    const p = v4m[1].split(".").map(Number);
    if (p.some((n) => n > 255)) return null;
    tailV4 = [p[0], p[1], p[2], p[3]];
    s = s.slice(0, v4m.index) + "0:0";
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups: number[] = [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 && head.length !== 8) return null;
  if (halves.length === 2 && fill < 0) return null;
  for (const g of head) groups.push(parseInt(g || "0", 16));
  for (let i = 0; i < (halves.length === 2 ? fill : 0); i++) groups.push(0);
  for (const g of tail) groups.push(parseInt(g || "0", 16));
  if (groups.length !== 8 || groups.some((n) => Number.isNaN(n) || n > 0xffff)) return null;
  if (tailV4) {
    groups[6] = (tailV4[0] << 8) | tailV4[1];
    groups[7] = (tailV4[2] << 8) | tailV4[3];
  }
  return groups;
}

export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const p = parseV4(ip);
    return p ? v4Blocked(p[0], p[1]) : true;
  }
  if (kind === 6) {
    const g = expandV6(ip);
    if (!g) return true;
    if (g.every((x) => x === 0)) return true; // ::
    if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
    const first = g[0];
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    // IPv4-mapped ::ffff:a.b.c.d → phân loại theo v4.
    if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
      return v4Blocked((g[6] >> 8) & 0xff, g[6] & 0xff);
    }
    return false;
  }
  return true; // không phải IP hợp lệ → chặn
}

export function isAllowedContentType(ct: string | undefined | null): boolean {
  if (!ct) return false;
  const v = ct.split(";")[0].trim().toLowerCase();
  return v.startsWith("video/") || v === "application/octet-stream";
}

// Resolve DNS rồi chặn nếu mọi/1 địa chỉ rơi vào dải cấm.
export async function assertHostAllowed(hostname: string): Promise<void> {
  // Nếu hostname đã là IP literal thì check thẳng.
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new SsrfError(`địa chỉ bị chặn: ${hostname}`);
    return;
  }
  const results = await lookup(hostname, { all: true });
  if (results.length === 0) throw new SsrfError(`không resolve được host: ${hostname}`);
  for (const r of results) {
    if (isBlockedIp(r.address)) throw new SsrfError(`host trỏ IP bị chặn: ${hostname} → ${r.address}`);
  }
}

interface DownloadOpts {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
}

// Tải file có SSRF guard: chỉ http(s), re-check IP mỗi hop redirect, ép content-type + cap size.
export async function guardedDownload(
  startUrl: string,
  sink: Writable,
  opts: DownloadOpts,
): Promise<{ contentType: string; bytes: number }> {
  const maxRedirects = opts.maxRedirects ?? 3;
  let current = new URL(startUrl);
  const deadline = AbortSignal.timeout(opts.timeoutMs);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new SsrfError(`chỉ hỗ trợ http/https, nhận: ${current.protocol}`);
    }
    await assertHostAllowed(current.hostname);

    // undici.request mặc định KHÔNG follow redirect → ta tự follow để re-check IP từng hop.
    const res = await request(current.toString(), {
      method: "GET",
      headers: { "user-agent": BROWSER_UA },
      signal: deadline,
    });

    if (res.statusCode >= 300 && res.statusCode < 400) {
      const loc = res.headers.location;
      const locStr = Array.isArray(loc) ? loc[0] : loc;
      if (!locStr) throw new SsrfError(`redirect ${res.statusCode} thiếu Location`);
      res.body.destroy();
      if (hop === maxRedirects) throw new SsrfError("quá số redirect cho phép");
      current = new URL(locStr, current);
      continue;
    }
    if (res.statusCode >= 400) {
      res.body.destroy();
      throw new SsrfError(`HTTP ${res.statusCode} khi tải video`);
    }

    const ct = res.headers["content-type"];
    const ctStr = Array.isArray(ct) ? ct[0] : ct;
    if (!isAllowedContentType(ctStr)) {
      res.body.destroy();
      throw new SsrfError(`content-type không phải video: ${ctStr ?? "(trống)"}`);
    }

    // Stream + đếm byte thực (không tin Content-Length), cap size.
    // Dùng stream.pipeline: nó gắn error handler cho MỌI stream trong chuỗi và huỷ
    // sạch khi lỗi/abort — biến 'error' event (vd undici RequestAbortedError khi
    // AbortSignal.timeout kích hoạt) thành promise rejection, thay vì làm sập process.
    let bytes = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        bytes += chunk.length;
        if (bytes > opts.maxBytes) {
          cb(new SsrfError(`vượt giới hạn ${opts.maxBytes} byte`));
          return;
        }
        cb(null, chunk);
      },
    });
    try {
      await pipeline(res.body, counter, sink);
    } catch (e) {
      res.body.destroy();
      throw e;
    }
    return { contentType: ctStr!.split(";")[0].trim().toLowerCase(), bytes };
  }
  throw new SsrfError("không tải được (hết redirect)");
}
