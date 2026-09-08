begin;
select plan(25);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-0000-4000-8000-000000000001','authenticated','authenticated','a@t.local','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-0000-4000-8000-000000000002','authenticated','authenticated','b@t.local','',now(),'{}','{}',now(),now());

insert into public.lessons (id, owner_id, title, source_type, status) values
 ('aaaa0000-0000-4000-8000-00000000000a','11111111-0000-4000-8000-000000000001','bài A','zoom','ready'),
 ('cccc0000-0000-4000-8000-00000000000c','11111111-0000-4000-8000-000000000001','bài xoá','zoom','ready');
update public.lessons set deleted_at = now() where id = 'cccc0000-0000-4000-8000-00000000000c';
insert into public.cues (id, lesson_id, idx, start_ms, end_ms, text_source, text_target) values
 ('aaaa1111-0000-4000-8000-000000000001','aaaa0000-0000-4000-8000-00000000000a',1,0,1000,'決済を確認します','xác nhận thanh toán'),
 ('cccc1111-0000-4000-8000-000000000001','cccc0000-0000-4000-8000-00000000000c',1,0,1000,'x','y');
insert into public.vocab_items (id, lesson_id, cue_id, term, reading, meaning) values
 ('aaaa2222-0000-4000-8000-000000000001','aaaa0000-0000-4000-8000-00000000000a','aaaa1111-0000-4000-8000-000000000001','決済','けっさい','thanh toán'),
 ('aaaa2222-0000-4000-8000-000000000002','aaaa0000-0000-4000-8000-00000000000a','aaaa1111-0000-4000-8000-000000000001','確認','かくにん','xác nhận');
insert into public.known_words (user_id, lang, term) values ('11111111-0000-4000-8000-000000000001','ja','決済');

-- Đóng vai A
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- enroll: 1 từ đã thuộc + 1 từ thường + 1 item thiếu term
select results_eq(
  $$select created, reactivated from public.enroll_cards('[
     {"lang":"ja","term":"決済","reading":"けっさい","meaning":"thanh toán","lesson_id":"aaaa0000-0000-4000-8000-00000000000a","cue_id":"aaaa1111-0000-4000-8000-000000000001"},
     {"lang":"ja","term":"確認","reading":"かくにん","meaning":"xác nhận","lesson_id":"aaaa0000-0000-4000-8000-00000000000a","cue_id":"aaaa1111-0000-4000-8000-000000000001"},
     {"lang":"ja","term":""}]'::jsonb)$$,
  $$values (2, 0)$$, 'enroll tạo 2 card, bỏ item thiếu term');
select is((select count(*) from public.known_words where term='決済'), 0::bigint, 'enroll gỡ known_words');
select is((select suspended from public.review_cards where term='決済'), false, 'card mới không suspended');
select is((select source_cue_id from public.review_cards where term='決済'), 'aaaa1111-0000-4000-8000-000000000001'::uuid, 'lưu source_cue_id');
select results_eq(
  $$select created, reactivated from public.enroll_cards('[{"lang":"ja","term":"決済"}]'::jsonb)$$,
  $$values (0, 1)$$, 'enroll lại → reactivated, không tạo trùng');

-- stats/queue ban đầu: 2 New, 0 due
select results_eq($$select due, new_available, new_last_24h from public.review_stats()$$, $$values (0, 2, 0)$$, 'stats: 2 New');
select is((select count(*) from public.review_queue()), 2::bigint, 'queue có 2 thẻ New');
select is((select cue_text_source from public.review_queue() where term='決済'), '決済を確認します', 'queue join câu ví dụ');
select is((select lesson_title from public.review_queue() where term='決済'), 'bài A', 'queue join tên bài');

-- review_card: card + log cùng lúc
create temp table c1 as select id from public.review_cards where term='決済';
select lives_ok($$select public.review_card((select id from c1), 3::smallint,
  '{"due_at":"2099-01-01T00:00:00Z","stability":3.1,"difficulty":5.2,"scheduled_days":3,"learning_steps":0,"reps":1,"lapses":0,"state":"Review","last_review_at":"2026-09-08T00:00:00Z"}'::jsonb,
  '{"rating":3,"state":0,"due":"2026-09-08T00:00:00Z","stability":0,"difficulty":0,"elapsed_days":0,"last_elapsed_days":0,"scheduled_days":0,"learning_steps":0,"review":"2026-09-01T00:00:00Z"}'::jsonb)$$,
  'review_card chạy được');
select is((select state from public.review_cards where id=(select id from c1)), 'Review', 'card cập nhật state');
select is((select count(*) from public.review_logs where card_id=(select id from c1)), 1::bigint, 'log được ghi');
select is((select new_last_24h from public.review_stats()), 0, 'log review ngày cũ không tính vào 24h');
update public.review_logs set reviewed_at = now() where card_id=(select id from c1);
select is((select new_last_24h from public.review_stats()), 1, 'log state=0 trong 24h được đếm');
select is((select count(*) from public.review_queue()), 1::bigint, 'thẻ đã review xa hạn rời queue');

-- undo: xoá log mới nhất, trả snapshot
select lives_ok($$select public.undo_review((select id from c1),
  '{"due_at":"2026-09-08T00:00:00Z","stability":0,"difficulty":0,"scheduled_days":0,"learning_steps":0,"reps":0,"lapses":0,"state":"New","last_review_at":null}'::jsonb)$$, 'undo chạy được');
select is((select count(*) from public.review_logs where card_id=(select id from c1)), 0::bigint, 'undo xoá log');
select is((select state from public.review_cards where id=(select id from c1)), 'New', 'undo trả state');
select throws_ok($$select public.undo_review((select id from c1), '{}'::jsonb)$$, 'P0002', null, 'undo khi không còn log → lỗi');

-- trigger known_words ↔ suspended
insert into public.known_words (user_id, lang, term) values ('11111111-0000-4000-8000-000000000001','ja','確認');
select is((select suspended from public.review_cards where term='確認'), true, 'đánh dấu đã thuộc → suspended');
select is((select in_review from public.my_dictionary() where term='確認'), false, 'my_dictionary.in_review=false khi suspended');
delete from public.known_words where term='確認';
select is((select suspended from public.review_cards where term='確認'), false, 'bỏ đánh dấu → unsuspended');

-- cap 20 New
insert into public.review_cards (user_id, lang, term)
  select '11111111-0000-4000-8000-000000000001','ja','w'||g from generate_series(1,25) g;
select is((select count(*) from public.review_queue() where state='New'), 20::bigint, 'queue tối đa 20 New (chưa review New nào trong 24h)');

-- Đóng vai B: không đụng được card của A
select set_config('request.jwt.claims','{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.review_card((select id from c1), 3::smallint, '{}'::jsonb, '{}'::jsonb)$$, 'P0002', null, 'B không review được card của A');
select is((select count(*) from public.review_queue()), 0::bigint, 'queue của B rỗng');

select * from finish();
rollback;
