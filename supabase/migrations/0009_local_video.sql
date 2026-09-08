-- 0009_local_video.sql — P2: provider 'local' (video không lên cloud) + kích cỡ file để web kiểm tra khớp.
alter table public.lessons drop constraint lessons_video_provider_check;
alter table public.lessons add constraint lessons_video_provider_check
  check (video_provider in ('storage','youtube','local'));
alter table public.lessons add column video_size_bytes bigint;
comment on column public.lessons.video_size_bytes is 'Kích cỡ file video gốc (byte). Chỉ để web cảnh báo khi người học chọn nhầm file local.';
