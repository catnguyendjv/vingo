import { Icon } from "@/components/ui/Icon";

export function EmptyState({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-muted">
        <Icon name="users" className="size-7" />
      </span>
      <p className="font-semibold">Chưa có bài học nào.</p>
      <p className="max-w-sm text-sm text-muted">
        {tab === "community"
          ? "Khi có bài được chia sẻ vào cộng đồng, bài sẽ hiện ở đây."
          : "Tạo bài mới từ Claude Code bằng skill study-kit, bài sẽ xuất hiện ở đây."}
      </p>
    </div>
  );
}
