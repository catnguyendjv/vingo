-- RLS theo spec §3.1. Mọi policy dùng (select auth.uid()); WITH CHECK tường minh.
create function public.can_read_lesson(l_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from lessons l
    where l.id = l_id and l.deleted_at is null
      and (l.owner_id = (select auth.uid())
           or (l.visibility = 'community' and l.status = 'ready'))
  );
$$;
grant execute on function public.can_read_lesson(uuid) to authenticated;

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table public.lessons enable row level security;
create policy lessons_select_own on public.lessons for select to authenticated
  using (owner_id = (select auth.uid()));
create policy lessons_select_community on public.lessons for select to authenticated
  using (visibility = 'community' and status = 'ready' and deleted_at is null);
create policy lessons_insert on public.lessons for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy lessons_update on public.lessons for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy lessons_delete on public.lessons for delete to authenticated
  using (owner_id = (select auth.uid()));

alter table public.cues enable row level security;
create policy cues_select on public.cues for select to authenticated
  using (public.can_read_lesson(lesson_id));
create policy cues_write on public.cues for insert to authenticated
  with check (exists (select 1 from public.lessons l
    where l.id = lesson_id and l.owner_id = (select auth.uid())));
create policy cues_update on public.cues for update to authenticated
  using (exists (select 1 from public.lessons l
    where l.id = lesson_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.lessons l
    where l.id = lesson_id and l.owner_id = (select auth.uid())));
create policy cues_delete on public.cues for delete to authenticated
  using (exists (select 1 from public.lessons l
    where l.id = lesson_id and l.owner_id = (select auth.uid())));

alter table public.vocab_items enable row level security;
create policy vocab_select on public.vocab_items for select to authenticated
  using (public.can_read_lesson(lesson_id));
create policy vocab_insert on public.vocab_items for insert to authenticated
  with check (exists (select 1 from public.lessons l
    where l.id = lesson_id and l.owner_id = (select auth.uid())));
create policy vocab_update on public.vocab_items for update to authenticated
  using (exists (select 1 from public.lessons l
    where l.id = lesson_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.lessons l
    where l.id = lesson_id and l.owner_id = (select auth.uid())));
create policy vocab_delete on public.vocab_items for delete to authenticated
  using (exists (select 1 from public.lessons l
    where l.id = lesson_id and l.owner_id = (select auth.uid())));

-- Các bảng thuần per-user: 1 mẫu policy 4 lệnh, user chỉ đụng dòng của mình.
do $$
declare t text;
begin
  foreach t in array array['known_words','cue_progress','review_cards','review_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t, t);
  end loop;
end $$;

-- pairing_codes/mcp_grants: user thấy + revoke của mình; tạo/validate là việc của service role.
alter table public.pairing_codes enable row level security;
create policy pairing_select on public.pairing_codes for select to authenticated
  using (user_id = (select auth.uid()));
alter table public.mcp_grants enable row level security;
create policy grants_select on public.mcp_grants for select to authenticated
  using (user_id = (select auth.uid()));
create policy grants_revoke on public.mcp_grants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- oauth_clients: chỉ service role → bật RLS, KHÔNG tạo policy nào.
alter table public.oauth_clients enable row level security;
