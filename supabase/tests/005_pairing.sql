begin;
select plan(6);

-- Fixtures: 2 user.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-0000-4000-8000-000000000001','authenticated','authenticated','p1@t.local','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-0000-4000-8000-000000000002','authenticated','authenticated','p2@t.local','',now(),'{}','{}',now(),now());

-- Đóng vai user1.
select set_config('request.jwt.claims',
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- Phát code lần 1, giữ lại để so hash.
create temp table pc as select public.create_pairing_code() as code;

select matches(
  (select code from pc),
  '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$',
  'code 8 ký tự trong bảng chữ đã bỏ I/L/O/0/1');

select is(
  (select count(*) from public.pairing_codes p, pc
   where p.user_id = '11111111-0000-4000-8000-000000000001'
     and p.consumed_at is null
     and p.code_hash = encode(digest(pc.code, 'sha256'), 'hex')),
  1::bigint, 'code_hash = sha256(code)');

select ok(
  (select expires_at from public.pairing_codes
   where user_id = '11111111-0000-4000-8000-000000000001')
   between now() + interval '9 minutes' and now() + interval '11 minutes',
  'TTL ~10 phút');

-- Phát code lần 2: code cũ bị xoá, chỉ còn 1 code sống.
select public.create_pairing_code();
select is(
  (select count(*) from public.pairing_codes
   where user_id = '11111111-0000-4000-8000-000000000001' and consumed_at is null),
  1::bigint, 'mỗi user tối đa 1 code sống');

-- User khác không SELECT được code của user1 (RLS pairing_select).
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*) from public.pairing_codes
   where user_id = '11111111-0000-4000-8000-000000000001'),
  0::bigint, 'user khác không đọc được code của user1');

-- anon không execute được.
reset role;
set local role anon;
select throws_ok(
  $$select public.create_pairing_code()$$,
  '42501', null, 'anon không gọi được create_pairing_code');

select * from finish();
rollback;
