-- P1 §5.1: RPC sinh pairing code cho luồng ghép nối Claude Code ↔ study-kit-mcp.
-- SECURITY DEFINER để ghi pairing_codes mà không cần service role key trong apps/web
-- (giữ ràng buộc P0: service role không bao giờ vào web). Chỉ lưu hash sha256 của code.
-- search_path gồm extensions vì gen_random_bytes/digest (pgcrypto) nằm ở schema extensions.
create function public.create_pairing_code() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  -- Bỏ I/L/O/0/1 để đọc/gõ tay không nhầm.
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  uid uuid := (select auth.uid());
  raw bytea := gen_random_bytes(8);
  code text := '';
  i int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Mỗi user tối đa 1 code sống: xoá code chưa consume trước khi phát code mới.
  delete from pairing_codes where user_id = uid and consumed_at is null;
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(raw, i) % 31) + 1, 1);
  end loop;
  insert into pairing_codes (user_id, code_hash, expires_at)
  values (uid, encode(digest(code, 'sha256'), 'hex'), now() + interval '10 minutes');
  return code;
end $$;

grant execute on function public.create_pairing_code() to authenticated;
revoke execute on function public.create_pairing_code() from public, anon;
