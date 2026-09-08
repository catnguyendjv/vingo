"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cardClass } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL ?? "http://localhost:8787/mcp";

export type GrantRow = {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
};

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label ?? "Sao chép"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch { /* clipboard bị chặn — bỏ qua */ }
      }}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Icon name={done ? "check" : "copy"} className="size-[17px]" />
    </button>
  );
}

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

export function SettingsView({
  userId,
  displayName,
  grants,
}: {
  userId: string;
  displayName: string;
  grants: GrantRow[];
}) {
  const supabase = useMemo(() => createClient(), []);

  // ── Pairing code ──
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [remaining, setRemaining] = useState(0);
  const [genning, setGenning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRemaining(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    timer.current = setInterval(tick, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [expiresAt]);

  const generate = async () => {
    setGenning(true);
    const { data, error } = await supabase.rpc("create_pairing_code");
    setGenning(false);
    if (error || !data) return;
    setCode(data as string);
    setExpiresAt(Date.now() + 10 * 60 * 1000);
  };

  const codeAlive = code && remaining > 0;
  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  // ── Devices ──
  const [devices, setDevices] = useState<GrantRow[]>(grants);
  const revoke = async (id: string) => {
    setDevices((d) => d.filter((g) => g.id !== id));
    await supabase.from("mcp_grants").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  };

  // ── Profile ──
  const [name, setName] = useState(displayName);
  const [savedName, setSavedName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const saveName = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", userId);
    setSaving(false);
    if (!error) setSavedName(name.trim());
  };

  const cmdAdd = `claude mcp add --transport http study-kit ${MCP_URL}`;
  const cmdLogin = "claude mcp login study-kit";

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-5">
      {/* Kết nối Claude Code */}
      <section className={`${cardClass} p-5`}>
        <h2 className="mb-1 text-[17px] font-bold">Kết nối Claude Code</h2>
        <p className="mb-4 text-sm text-muted">
          Tạo bài học mới từ Claude Code qua skill <code className="rounded bg-surface-2 px-1">study-kit</code>.
          Tạo mã ghép nối rồi dán vào Claude khi đăng nhập MCP.
        </p>

        {!codeAlive ? (
          <Button variant="primary" onClick={generate} disabled={genning} data-testid="generate-code">
            <Icon name="plus" className="size-[18px]" />
            {code ? "Tạo mã mới" : "Tạo mã ghép nối"}
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div
              data-testid="pairing-code"
              className="flex items-center gap-1 rounded-xl border border-line bg-surface-2 px-4 py-3 font-mono text-2xl font-bold tracking-[.3em]"
            >
              {code}
            </div>
            <CopyButton value={code!} label="Sao chép mã" />
            <span className="text-sm tabular-nums text-muted">Hết hạn sau {mmss}</span>
          </div>
        )}
        {code && !codeAlive && <p className="mt-2 text-sm text-danger">Mã đã hết hạn — tạo mã mới.</p>}

        <div className="mt-5 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">2 lệnh trong Claude Code</p>
          {[cmdAdd, cmdLogin].map((cmd) => (
            <div key={cmd} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-2 pl-3 pr-2">
              {/* <pre> thay <code>: overflow-x-auto cần block; min-w-0 để flex cho phép co (spec P2 §6 M3) */}
              <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[13px] leading-relaxed [scrollbar-width:thin]">{cmd}</pre>
              <CopyButton value={cmd} />
            </div>
          ))}
        </div>
      </section>

      {/* Thiết bị đã kết nối */}
      <section className={`${cardClass} p-5`}>
        <h2 className="mb-3 text-[17px] font-bold">Thiết bị đã kết nối</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-muted">Chưa có thiết bị nào. Ghép nối Claude Code ở trên để bắt đầu.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {devices.map((g) => (
              <li key={g.id} data-testid="device-row" className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{g.device_label || "Thiết bị Claude Code"}</div>
                  <div className="text-xs text-muted">
                    Kết nối {fmt(g.created_at)} · Dùng gần nhất {fmt(g.last_used_at)}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(g.id)}>
                  <Icon name="x" className="size-4" />
                  Thu hồi
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Hồ sơ */}
      <section className={`${cardClass} p-5`}>
        <h2 className="mb-3 text-[17px] font-bold">Hồ sơ</h2>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="display_name">Tên hiển thị</label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="display_name"
            className="min-w-[220px] flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={saveName} disabled={saving || name.trim() === savedName || name.trim() === ""}>
            Lưu
          </Button>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="soft">
              <Icon name="log-out" className="size-[18px]" />
              Đăng xuất
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
