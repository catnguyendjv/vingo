// apps/web/src/components/study/ShareButton.tsx — đổi visibility bài (owner). Dialog xác nhận riêng cho zoom (spec P2 §4.2, P2-7).
"use client";
import { useState } from "react";
import type { LessonRow } from "@/lib/types";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";

export function ShareButton({ lesson, visibility, onChange }: {
  lesson: Pick<LessonRow, "source_type" | "status" | "video_provider">;
  visibility: LessonRow["visibility"]; onChange: (v: LessonRow["visibility"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const shared = visibility === "community";
  const isZoom = lesson.source_type === "zoom";
  const notReady = lesson.status !== "ready";
  // Đang community → về private ngay, không dialog; private → mở dialog xác nhận.
  const click = () => { if (shared) onChange("private"); else setOpen(true); };
  const close = () => { setOpen(false); setConfirmed(false); };
  const doShare = () => { onChange("community"); close(); };
  return (
    <>
      <IconButton
        label={shared ? "Đang chia sẻ" : "Chia sẻ"} pressed={shared} onClick={click} disabled={notReady}
        title={notReady ? "Chỉ chia sẻ được bài đã sẵn sàng" : undefined} data-testid="share-button"
        className="disabled:opacity-50"
      >
        <Icon name="share" className="size-[18px]" />
      </IconButton>
      <Dialog open={open} onClose={close} title={isZoom ? "Chia sẻ bản ghi họp?" : "Chia sẻ lên cộng đồng?"} testId="share-dialog"
        footer={<>
          <Button onClick={close}>Huỷ</Button>
          <Button variant="primary" onClick={doShare} disabled={isZoom && !confirmed}>Chia sẻ lên cộng đồng</Button>
        </>}
      >
        <p>Mọi người dùng Vingo sẽ xem được bài, transcript và từ vựng. Tiến độ học vẫn riêng từng người.</p>
        {isZoom && <p className="mt-2">Người trong video đã đồng ý chưa? Tên khách hàng, dự án nhạy cảm đã ẩn chưa?</p>}
        {lesson.video_provider === "local" && <p className="mt-2">Video nằm trên máy bạn — người xem sẽ phải tự có file video.</p>}
        {isZoom && (
          <label className="mt-3 flex items-center gap-2 text-ink">
            <Checkbox checked={confirmed} onChange={() => setConfirmed((c) => !c)} label="Tôi đã xác nhận" />
            Tôi đã xác nhận
          </label>
        )}
      </Dialog>
    </>
  );
}
