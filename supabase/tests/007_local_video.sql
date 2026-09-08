-- supabase/tests/007_local_video.sql — P2: provider 'local' + video_size_bytes.
begin;
select plan(3);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-0000-4000-8000-000000000001','authenticated','authenticated','owner@t.local','',now(),'{}','{}',now(),now());

select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.lessons (id, owner_id, title, source_type, source_lang, target_lang, video_provider, video_ref, duration_sec, video_size_bytes, status)
    values ('aaaa0000-0000-4000-8000-00000000000a','11111111-0000-4000-8000-000000000001','bài local','zoom','ja','vi','local','meeting.mp4',2617,734003200,'ready')$$,
  'owner tạo được bài video local');
select is((select video_size_bytes from public.lessons where id='aaaa0000-0000-4000-8000-00000000000a'), 734003200::bigint, 'lưu video_size_bytes');
select throws_ok(
  $$insert into public.lessons (id, owner_id, title, source_type, video_provider)
    values ('bbbb0000-0000-4000-8000-00000000000b','11111111-0000-4000-8000-000000000001','sai provider','zoom','dropbox')$$,
  '23514', null, 'provider lạ bị check constraint từ chối');

select * from finish();
rollback;
