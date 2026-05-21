alter table public.classes
  add column if not exists room text,
  add column if not exists weekdays text[] not null default '{}',
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists age_range text,
  add column if not exists level text;

alter table public.classes
  add constraint classes_valid_time_range check (
    start_time is null
    or end_time is null
    or end_time > start_time
  );

create index if not exists classes_room_idx on public.classes (room);
create index if not exists classes_level_idx on public.classes (level);
