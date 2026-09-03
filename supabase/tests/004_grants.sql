begin;
select plan(3);

-- (a)/(b): anon không được EXECUTE các function security definer/stable nhạy cảm.
set local role anon;
select throws_ok(
  $$select public.can_read_lesson('00000000-0000-4000-8000-000000000000')$$,
  '42501', null, 'anon không gọi được can_read_lesson');
select throws_ok(
  $$select * from public.my_dictionary()$$,
  '42501', null, 'anon không gọi được my_dictionary');
reset role;

-- (c): idempotent trigger - profile đã tồn tại sẵn cho uuid, sau đó signup (insert auth.users)
-- với cùng id không được throw (on conflict do nothing trong handle_new_user()).
set local session_replication_role = replica;
insert into public.profiles (id, display_name) values
 ('33333333-0000-4000-8000-000000000003', 'pre-existing');
set local session_replication_role = origin;

select lives_ok(
  $$insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000','33333333-0000-4000-8000-000000000003','authenticated','authenticated','dup@t.local','',now(),'{}','{}',now(),now())$$,
  'signup không throw khi profile đã tồn tại sẵn cho id đó');

select * from finish();
rollback;
