-- Siết quyền: gỡ PUBLIC/anon khỏi các function bị lộ mặc định lúc create function,
-- gỡ quyền anon khỏi các bảng hạ tầng nhạy cảm, và làm handle_new_user idempotent.

revoke execute on function public.can_read_lesson(uuid) from public, anon;
revoke execute on function public.my_dictionary() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;

revoke all on table public.oauth_clients, public.pairing_codes, public.mcp_grants from anon;

-- Idempotent: nếu profile đã được tạo trước đó (vd bootstrap thủ công), không throw nữa.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
