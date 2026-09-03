insert into storage.buckets (id, name, public) values ('videos','videos', false)
on conflict (id) do nothing;

-- Cho phép user ĐỌC (và do đó ký signed URL) object của lesson mà can_read_lesson pass.
-- path: {owner_id}/{lesson_id}/file → (storage.foldername(name))[2] = lesson_id
create policy videos_read on storage.objects for select to authenticated
using (
  bucket_id = 'videos'
  and public.can_read_lesson(((storage.foldername(name))[2])::uuid)
);
-- KHÔNG có policy insert/update/delete: ghi storage chỉ qua service role (script migrate P0, MCP P1).
