-- Per-user state + bảng hạ tầng MCP (spec §3). P0 chỉ dùng known_words/cue_progress;
-- các bảng còn lại tạo sẵn để P1/P1.5 không cần migration nền tảng.
create table public.known_words (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lang text not null,
  term text not null,
  reading text,
  meaning text,
  first_lesson_id uuid references public.lessons(id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (user_id, lang, term)
);

create table public.cue_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cue_id uuid not null references public.cues(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (user_id, cue_id)
);
create index cue_progress_user_lesson_idx on public.cue_progress(user_id, lesson_id);

create table public.review_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lang text not null,
  term text not null,
  reading text,
  meaning text,
  source_lesson_id uuid references public.lessons(id) on delete set null,
  due_at timestamptz not null default now(),
  stability real,
  difficulty real,
  scheduled_days int,
  learning_steps int,
  reps int not null default 0,
  lapses int not null default 0,
  state text not null default 'New' check (state in ('New','Learning','Review','Relearning')),
  last_review_at timestamptz,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lang, term)
);
create trigger review_cards_updated_at before update on public.review_cards
for each row execute function public.set_updated_at();
create index review_cards_due_idx on public.review_cards(user_id, due_at);

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.review_cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null,
  reviewed_at timestamptz not null default now(),
  log jsonb not null
);
create index review_logs_card_idx on public.review_logs(card_id);

create table public.pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.mcp_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  device_label text,
  access_token_hash text,
  refresh_token_hash text,
  access_expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index mcp_grants_user_idx on public.mcp_grants(user_id);

create table public.oauth_clients (
  client_id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
