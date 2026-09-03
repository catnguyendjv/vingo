begin;
select plan(4);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-0000-4000-8000-000000000001','authenticated','authenticated','o@t.local','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-0000-4000-8000-000000000002','authenticated','authenticated','s@t.local','',now(),'{}','{}',now(),now());

-- Bài community của owner 1 (user 2 ĐÃ học) + bài community KHÁC user 2 CHƯA học
insert into public.lessons (id, owner_id, title, source_type, status, visibility) values
 ('aaaa0000-0000-4000-8000-00000000000a','11111111-0000-4000-8000-000000000001','đã học','zoom','ready','community'),
 ('bbbb0000-0000-4000-8000-00000000000b','11111111-0000-4000-8000-000000000001','chưa học','zoom','ready','community');
insert into public.cues (id, lesson_id, idx, start_ms, end_ms, text_source) values
 ('aaaa1111-0000-4000-8000-000000000001','aaaa0000-0000-4000-8000-00000000000a',1,0,1000,'a'),
 ('bbbb1111-0000-4000-8000-000000000001','bbbb0000-0000-4000-8000-00000000000b',1,0,1000,'b');
insert into public.vocab_items (id, lesson_id, cue_id, term, reading, meaning) values
 ('aaaa2222-0000-4000-8000-000000000001','aaaa0000-0000-4000-8000-00000000000a','aaaa1111-0000-4000-8000-000000000001','決済','けっさい','thanh toán'),
 ('bbbb2222-0000-4000-8000-000000000001','bbbb0000-0000-4000-8000-00000000000b','bbbb1111-0000-4000-8000-000000000001','進捗','しんちょく','tiến độ');
insert into public.cue_progress (user_id, cue_id, lesson_id) values
 ('22222222-0000-4000-8000-000000000002','aaaa1111-0000-4000-8000-000000000001','aaaa0000-0000-4000-8000-00000000000a');
insert into public.known_words (user_id, lang, term) values
 ('22222222-0000-4000-8000-000000000002','ja','決済');

select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from my_dictionary()), 1::bigint, 'chỉ gồm bài đã học (không gồm community chưa học)');
select is((select term from my_dictionary() limit 1), '決済', 'đúng term');
select is((select is_known from my_dictionary() where term='決済'), true, 'is_known ăn theo known_words');
select is((select occurrences from my_dictionary() where term='決済'), 1::bigint, 'đếm occurrences');

select * from finish();
rollback;
