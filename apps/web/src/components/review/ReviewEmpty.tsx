"use client";
import Link from "next/link";
import { formatInterval } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function ReviewEmpty({ kind, reviewed, nextDueAt, now }: {
  kind: "none" | "done"; reviewed: number; nextDueAt: string | null; now: Date;
}) {
  const nextIn = nextDueAt ? formatInterval(Date.parse(nextDueAt) - now.getTime()) : null;
  return (
    <section data-testid="review-empty" data-kind={kind} className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-5 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name={kind === "done" ? "check-check" : "flip"} className="size-7" />
      </span>
      {kind === "none" ? (
        <>
          <h2 className="text-lg font-semibold">Chưa có từ nào để ôn</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            <li>Trên trang học: mở mặt sau flashcard rồi bấm <b className="text-ink">Ôn tập</b>, hoặc <b className="text-ink">Ôn tập cả bài</b> ở panel từ vựng.</li>
            <li>Trong <b className="text-ink">Từ điển</b>: bấm <b className="text-ink">Ôn tập</b> ở từ muốn nhớ.</li>
          </ul>
          <div className="flex gap-2">
            <Link href="/"><Button variant="primary">Về thư viện</Button></Link>
            <Link href="/dictionary"><Button>Mở từ điển</Button></Link>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Xong phiên hôm nay</h2>
          <p className="text-sm text-muted">
            Đã ôn <b className="tabular-nums text-ink">{reviewed}</b> thẻ.
            {nextIn && <> Thẻ tiếp theo đến hạn sau <b className="text-ink">{nextIn}</b>.</>}
          </p>
          <Link href="/"><Button>Về thư viện</Button></Link>
        </>
      )}
    </section>
  );
}
