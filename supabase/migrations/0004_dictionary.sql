-- Từ điển toàn thư viện của tôi (spec §3.1). SECURITY INVOKER (mặc định) → chạy dưới RLS caller.
create function public.my_dictionary()
returns table (
  lang text, term text, reading text, meaning text,
  occurrences bigint, lesson_ids uuid[], cue_ids uuid[], is_known boolean
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
                 where k.user_id = (select auth.uid()) and k.lang = v.lang and k.term = v.term) as is_known
  from v group by v.lang, v.term;
$$;
grant execute on function public.my_dictionary() to authenticated;
