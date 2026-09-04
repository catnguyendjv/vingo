import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  SsrfError,
  assertHostAllowed,
  guardedDownload,
  isAllowedContentType,
  isBlockedIp,
} from "./ssrf.js";

const sink = () => new Writable({ write(_c, _e, cb) { cb(); } });

describe("isBlockedIp — IPv4", () => {
  it.each([
    "10.0.0.1", "10.255.255.255",
    "172.16.0.1", "172.31.255.255",
    "192.168.1.1",
    "127.0.0.1", "127.1.2.3",
    "169.254.169.254", "169.254.0.1",
    "0.0.0.0",
    "100.64.0.1",
    "224.0.0.1", "255.255.255.255",
  ])("chặn private/loopback/link-local/metadata %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "192.169.0.1", "13.107.42.14"])(
    "cho phép IP public %s",
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    },
  );
});

describe("isBlockedIp — IPv6", () => {
  it.each(["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"])(
    "chặn %s",
    (ip) => expect(isBlockedIp(ip)).toBe(true),
  );
  it.each(["2001:4860:4860::8888", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "cho phép %s",
    (ip) => expect(isBlockedIp(ip)).toBe(false),
  );
  it("chuỗi rác bị chặn", () => expect(isBlockedIp("not-an-ip")).toBe(true));
});

describe("isAllowedContentType", () => {
  it.each(["video/mp4", "video/webm", "application/octet-stream", "video/mp4; codecs=avc1"])(
    "cho phép %s",
    (ct) => expect(isAllowedContentType(ct)).toBe(true),
  );
  it.each([undefined, null, "", "text/html", "application/json", "image/jpeg"])(
    "chặn %s",
    (ct) => expect(isAllowedContentType(ct)).toBe(false),
  );
});

describe("assertHostAllowed", () => {
  it("chặn localhost (resolve 127.0.0.1)", async () => {
    await expect(assertHostAllowed("localhost")).rejects.toBeInstanceOf(SsrfError);
  });
  it("chặn IP metadata literal", async () => {
    await expect(assertHostAllowed("169.254.169.254")).rejects.toBeInstanceOf(SsrfError);
  });
  it("cho phép host public", async () => {
    await expect(assertHostAllowed("8.8.8.8")).resolves.toBeUndefined();
  });
});

describe("guardedDownload", () => {
  it("chặn protocol không phải http/https", async () => {
    await expect(
      guardedDownload("ftp://example.com/x", sink(), { maxBytes: 1000, timeoutMs: 1000 }),
    ).rejects.toBeInstanceOf(SsrfError);
  });
  it("chặn URL trỏ IP nội bộ trước khi connect", async () => {
    await expect(
      guardedDownload("http://127.0.0.1:1/video.mp4", sink(), { maxBytes: 1000, timeoutMs: 1000 }),
    ).rejects.toBeInstanceOf(SsrfError);
  });
});
