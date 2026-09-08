-- P1.5 SRS (spec docs/superpowers/specs/2026-09-08-vingo-p15-srs-design.md §2).
-- Mọi hàm security invoker: RLS per-user hiện có (0003) là chốt quyền.

alter table public.review_cards
  add column source_cue_id uuid references public.cues(id) on delete set null;

-- §2.2 known_words → review_cards.suspended (chạy dưới RLS của user đang ghi).
create function public.sync_known_to_cards() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update review_cards set suspended = true
      where user_id = new.user_id and lang = new.lang and term = new.term and suspended = false;
    return new;
  end if;
  update review_cards set suspended = false
    where user_id = old.user_id and lang = old.lang and term = old.term and suspended = true;
  return old;
end $$;
create trigger known_words_sync_cards
after insert or delete on public.known_words
for each row execute function public.sync_known_to_cards();

-- §2.3 Enroll hàng loạt: gỡ known_words, tạo card hoặc bật lại card cũ (first-wins).
create function public.enroll_cards(items jsonb)
returns table(created int, reactivated int)
language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  it jsonb; c int := 0; r int := 0; was_insert boolean;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  for it in select * from jsonb_array_elements(coalesce(items, '[]'::jsonb)) loop
    continue when nullif(it->>'lang', '') is null or nullif(it->>'term', '') is null;
    delete from known_words where user_id = uid and lang = it->>'lang' and term = it->>'term';
    insert into review_cards (user_id, lang, term, reading, meaning, source_lesson_id, source_cue_id, due_at)
    values (uid, it->>'lang', it->>'term', it->>'reading', it->>'meaning',
            (it->>'lesson_id')::uuid, (it->>'cue_id')::uuid, now())
    on conflict (user_id, lang, term) do update set suspended = false
    returning (xmax = 0) into was_insert;
    if was_insert then c := c + 1; else r := r + 1; end if;
  end loop;
  created := c; reactivated := r;
  return next;
end $$;

-- §2.4 Ghi kết quả review: card + log trong một transaction. Client (ts-fsrs) tính lịch.
create function public.review_card(p_card_id uuid, p_rating smallint, p_card jsonb, p_log jsonb)
returns public.review_cards
language plpgsql security invoker set search_path = public as $$
declare uid uuid := (select auth.uid()); rc public.review_cards;
begin
  if p_rating is null or p_rating not between 1 and 4 then
    raise exception 'invalid rating' using errcode = '22023';
  end if;
  update review_cards set
    due_at = (p_card->>'due_at')::timestamptz,
    stability = (p_card->>'stability')::real,
    difficulty = (p_card->>'difficulty')::real,
    scheduled_days = (p_card->>'scheduled_days')::int,
    learning_steps = (p_card->>'learning_steps')::int,
    reps = (p_card->>'reps')::int,
    lapses = (p_card->>'lapses')::int,
    state = p_card->>'state',
    last_review_at = (p_card->>'last_review_at')::timestamptz
  where id = p_card_id and user_id = uid
  returning * into rc;
  if rc.id is null then raise exception 'card not found' using errcode = 'P0002'; end if;
  insert into review_logs (card_id, user_id, rating, reviewed_at, log)
  values (p_card_id, uid, p_rating, coalesce((p_log->>'review')::timestamptz, now()), p_log);
  return rc;
end $$;

-- §2.5 Undo lần review cuối: xoá log mới nhất, trả card về snapshot client gửi.
create function public.undo_review(p_card_id uuid, p_card jsonb)
returns public.review_cards
language plpgsql security invoker set search_path = public as $$
declare uid uuid := (select auth.uid()); rc public.review_cards; lid uuid;
begin
  select id into lid from review_logs
    where card_id = p_card_id and user_id = uid
    order by reviewed_at desc, id desc limit 1;
  if lid is null then raise exception 'no review to undo' using errcode = 'P0002'; end if;
  delete from review_logs where id = lid;
  update review_cards set
    due_at = (p_card->>'due_at')::timestamptz,
    stability = (p_card->>'stability')::real,
    difficulty = (p_card->>'difficulty')::real,
    scheduled_days = (p_card->>'scheduled_days')::int,
    learning_steps = (p_card->>'learning_steps')::int,
    reps = (p_card->>'reps')::int,
    lapses = (p_card->>'lapses')::int,
    state = p_card->>'state',
    last_review_at = (p_card->>'last_review_at')::timestamptz
  where id = p_card_id and user_id = uid
  returning * into rc;
  if rc.id is null then raise exception 'card not found' using errcode = 'P0002'; end if;
  return rc;
end $$;

-- §2.6 Số liệu cho badge header + màn "Xong phiên". Cap New tính theo 24h trượt.
-- ReviewLog.state của ts-fsrs là state TRƯỚC khi review; 0 = New.
create function public.review_stats()
returns table(due int, new_available int, new_last_24h int, next_due_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select
    (select count(*) from review_cards
      where user_id = (select auth.uid()) and not suspended and state <> 'New' and due_at <= now())::int,
    (select count(*) from review_cards
      where user_id = (select auth.uid()) and not suspended and state = 'New')::int,
    (select count(*) from review_logs
      where user_id = (select auth.uid()) and reviewed_at > now() - interval '24 hours'
        and log->>'state' = '0')::int,
    (select min(due_at) from review_cards
      where user_id = (select auth.uid()) and not suspended and due_at > now());
$$;

-- §2.7 Hàng đợi phiên ôn đã áp cap, join sẵn câu ví dụ + tên bài (RLS lessons/cues tự lọc).
create function public.review_queue()
returns table(
  id uuid, lang text, term text, reading text, meaning text,
  due_at timestamptz, stability real, difficulty real, scheduled_days int, learning_steps int,
  reps int, lapses int, state text, last_review_at timestamptz, created_at timestamptz,
  source_lesson_id uuid, lesson_title text, source_cue_id uuid, cue_idx int,
  cue_text_source text, cue_text_target text
) language sql stable security invoker set search_path = public as $$
  with picked as (
    select rc.* from review_cards rc
      where rc.user_id = (select auth.uid()) and not rc.suspended
        and rc.state <> 'New' and rc.due_at <= now()
    union all
    (select rc.* from review_cards rc
      where rc.user_id = (select auth.uid()) and not rc.suspended and rc.state = 'New'
      order by rc.created_at asc
      limit greatest(0, 20 - (select s.new_last_24h from review_stats() s)))
  )
  select p.id, p.lang, p.term, p.reading, p.meaning,
         p.due_at, p.stability, p.difficulty, p.scheduled_days, p.learning_steps,
         p.reps, p.lapses, p.state, p.last_review_at, p.created_at,
         p.source_lesson_id, l.title, p.source_cue_id, c.idx, c.text_source, c.text_target
  from picked p
  left join lessons l on l.id = p.source_lesson_id and l.deleted_at is null
  left join cues c on c.id = p.source_cue_id
  order by (p.state = 'New'), p.due_at, p.created_at;
$$;

-- §2.8 my_dictionary v2: thêm in_review (đổi kiểu trả về → drop/create, thân giữ nguyên 0004).
drop function public.my_dictionary();
create function public.my_dictionary()
returns table (
  lang text, term text, reading text, meaning text,
  occurrences bigint, lesson_ids uuid[], cue_ids uuid[], is_known boolean, in_review boolean
) language sql stable set search_path = public as $$
  with accessible as (
    select l.id, l.source_lang
    from lessons l
    where l.deleted_at is null
      and (l.owner_id = (select auth.uid())
           or exists (select 1 from cue_progress cp
                      where cp.user_id = (select auth.uid()) and cp.lesson_id = l.id))
  ), v as (
    select a.source_lang as lang, vi.term, vi.reading, vi.meaning, vi.lesson_id, vi.cue_id,
           row_number() over (partition by a.source_lang, vi.term order by vi.created_at desc) as rn
    from vocab_items vi join accessible a on a.id = vi.lesson_id
  )
  select v.lang, v.term,
         max(v.reading) filter (where v.rn = 1) as reading,
         max(v.meaning) filter (where v.rn = 1) as meaning,
         count(*)::bigint as occurrences,
         array_agg(distinct v.lesson_id) as lesson_ids,
         array_agg(v.cue_id) as cue_ids,
         exists (select 1 from known_words k
                 where k.user_id = (select auth.uid()) and k.lang = v.lang and k.term = v.term) as is_known,
         exists (select 1 from review_cards rc
                 where rc.user_id = (select auth.uid()) and rc.lang = v.lang and rc.term = v.term
                   and rc.suspended = false) as in_review
  from v group by v.lang, v.term;
$$;

-- Grants (mẫu 0006): gỡ PUBLIC/anon, chỉ authenticated gọi được.
revoke execute on function
  public.sync_known_to_cards(), public.enroll_cards(jsonb),
  public.review_card(uuid, smallint, jsonb, jsonb), public.undo_review(uuid, jsonb),
  public.review_stats(), public.review_queue(), public.my_dictionary()
  from public, anon;
grant execute on function
  public.enroll_cards(jsonb), public.review_card(uuid, smallint, jsonb, jsonb),
  public.undo_review(uuid, jsonb), public.review_stats(), public.review_queue(), public.my_dictionary()
  to authenticated;
