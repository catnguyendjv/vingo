begin;
select plan(10);

-- Fixtures (chạy quyền postgres, bypass RLS)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-0000-4000-8000-000000000001','authenticated','authenticated','owner@t.local','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-0000-4000-8000-000000000002','authenticated','authenticated','other@t.local','',now(),'{}','{}',now(),now());

insert into public.lessons (id, owner_id, title, source_type, source_lang, target_lang, video_provider, status, visibility) values
 ('aaaa0000-0000-4000-8000-00000000000a','11111111-0000-4000-8000-000000000001','private bài','zoom','ja','vi','storage','ready','private'),
 ('bbbb0000-0000-4000-8000-00000000000b','11111111-0000-4000-8000-000000000001','community bài','zoom','ja','vi','storage','ready','community'),
 ('cccc0000-0000-4000-8000-00000000000c','11111111-0000-4000-8000-000000000001','community đã xoá','zoom','ja','vi','storage','ready','community');
update public.lessons set deleted_at = now() where id = 'cccc0000-0000-4000-8000-00000000000c';

insert into public.cues (id, lesson_id, idx, start_ms, end_ms, text_source) values
 ('aaaa1111-0000-4000-8000-000000000001','aaaa0000-0000-4000-8000-00000000000a',1,0,1000,'秘密'),
 ('bbbb1111-0000-4000-8000-000000000001','bbbb0000-0000-4000-8000-00000000000b',1,0,1000,'公開');

-- Đóng vai user KHÁC (không phải owner)
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.lessons where id='aaaa0000-0000-4000-8000-00000000000a'), 0::bigint, 'người khác không thấy bài private');
select is((select count(*) from public.lessons where id='bbbb0000-0000-4000-8000-00000000000b'), 1::bigint, 'người khác thấy bài community ready');
select is((select count(*) from public.lessons where id='cccc0000-0000-4000-8000-00000000000c'), 0::bigint, 'bài community đã soft-delete bị ẩn');
select is((select count(*) from public.cues where lesson_id='aaaa0000-0000-4000-8000-00000000000a'), 0::bigint, 'cues bài private bị ẩn');
select is((select count(*) from public.cues where lesson_id='bbbb0000-0000-4000-8000-00000000000b'), 1::bigint, 'cues bài community đọc được');
select throws_ok(
  $$insert into public.lessons (id, owner_id, title, source_type)
    values ('dddd0000-0000-4000-8000-00000000000d','11111111-0000-4000-8000-000000000001','giả owner','zoom')$$,
  '42501', null, 'không tạo được bài gán owner người khác');
select throws_ok(
  $$insert into public.cues (id, lesson_id, idx, start_ms, end_ms, text_source)
    values ('eeee1111-0000-4000-8000-000000000001','bbbb0000-0000-4000-8000-00000000000b',9,0,1000,'x')$$,
  '42501', null, 'không chèn được cue vào bài người khác');
select throws_ok(
  $$insert into public.known_words (user_id, lang, term)
    values ('11111111-0000-4000-8000-000000000001','ja','盗む')$$,
  '42501', null, 'không ghi known_words hộ người khác');

-- Share community (spec P2 §4.1): người khác đọc được visibility nhưng không đổi được (UPDATE 0 dòng, không lỗi)
select is((select count(*) from public.lessons where id='bbbb0000-0000-4000-8000-00000000000b' and visibility='community'), 1::bigint, 'đọc được visibility bài community');
update public.lessons set visibility='private' where id='bbbb0000-0000-4000-8000-00000000000b';
select is((select visibility from public.lessons where id='bbbb0000-0000-4000-8000-00000000000b'), 'community', 'người khác không đổi được visibility (UPDATE 0 dòng)');

select * from finish();
rollback;
