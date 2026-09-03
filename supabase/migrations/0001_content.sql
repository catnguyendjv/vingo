-- Nội dung: profiles, lessons, cues, vocab_items (spec §3)
create extension if not exists pgcrypto;

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  native_lang text not null default 'vi',
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.lessons (
  id uuid primary key,
  owner_id uuid not null references public.profiles(id),
  title text not null,
  lesson_date date,
  source_type text not null check (source_type in ('zoom','youtube','upload')),
  source_ref text,
  source_lang text not null default 'ja',
  target_lang text not null default 'vi',
  video_provider text check (video_provider in ('storage','youtube')),
  video_ref text,
  duration_sec int,
  thumb_path text,
  status text not null default 'draft' check (status in ('draft','processing','ready','error')),
  ingest_error text,
  visibility text not null default 'private' check (visibility in ('private','community')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger lessons_updated_at before update on public.lessons
for each row execute function public.set_updated_at();

create table public.cues (
  id uuid primary key,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  idx int not null,
  start_ms int not null,
  end_ms int not null,
  text_source text not null,
  text_target text,
  uncertain boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, idx),
  unique (id, lesson_id),
  check (start_ms < end_ms)
);
create trigger cues_updated_at before update on public.cues
for each row execute function public.set_updated_at();

create table public.vocab_items (
  id uuid primary key,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  cue_id uuid not null,
  term text not null,
  reading text,
  meaning text not null,
  sort int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (cue_id, lesson_id) references public.cues(id, lesson_id) on delete cascade
);
create trigger vocab_items_updated_at before update on public.vocab_items
for each row execute function public.set_updated_at();

create index lessons_owner_idx on public.lessons(owner_id);
create index lessons_community_idx on public.lessons(visibility, status) where deleted_at is null;
create index cues_lesson_idx on public.cues(lesson_id);
create index vocab_lesson_idx on public.vocab_items(lesson_id);
create index vocab_cue_idx on public.vocab_items(cue_id);
