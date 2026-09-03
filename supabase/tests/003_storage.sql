begin;
select plan(2);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-0000-4000-8000-000000000001','authenticated','authenticated','o@t.local','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-0000-4000-8000-000000000002','authenticated','authenticated','s@t.local','',now(),'{}','{}',now(),now());
insert into public.lessons (id, owner_id, title, source_type, status, visibility) values
 ('aaaa0000-0000-4000-8000-00000000000a','11111111-0000-4000-8000-000000000001','private','zoom','ready','private'),
 ('bbbb0000-0000-4000-8000-00000000000b','11111111-0000-4000-8000-000000000001','community','zoom','ready','community');
insert into storage.objects (bucket_id, name) values
 ('videos','11111111-0000-4000-8000-000000000001/aaaa0000-0000-4000-8000-00000000000a/video.mp4'),
 ('videos','11111111-0000-4000-8000-000000000001/bbbb0000-0000-4000-8000-00000000000b/video.mp4');

select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from storage.objects where name like '%aaaa0000%'), 0::bigint, 'không đọc được object bài private');
select is((select count(*) from storage.objects where name like '%bbbb0000%'), 1::bigint, 'đọc được object bài community');

select * from finish();
rollback;
