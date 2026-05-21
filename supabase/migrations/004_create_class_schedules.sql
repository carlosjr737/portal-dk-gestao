-- Temporary development policies allow anon access.
-- Replace these policies before production.

create table if not exists public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  weekday text not null,
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_schedules_weekday_check check (
    weekday in (
      'segunda',
      'terca',
      'quarta',
      'quinta',
      'sexta',
      'sabado',
      'domingo'
    )
  ),
  constraint class_schedules_valid_time_range check (end_time > start_time)
);

create index if not exists class_schedules_class_id_idx
  on public.class_schedules (class_id);

create index if not exists class_schedules_weekday_idx
  on public.class_schedules (weekday);

create index if not exists class_schedules_start_time_idx
  on public.class_schedules (start_time);

create trigger class_schedules_set_updated_at
before update on public.class_schedules
for each row execute function public.set_updated_at();

alter table public.class_schedules enable row level security;

create policy "Temporary anon select during local development"
on public.class_schedules
for select
to anon
using (true);

create policy "Temporary anon insert during local development"
on public.class_schedules
for insert
to anon
with check (true);

create policy "Temporary anon update during local development"
on public.class_schedules
for update
to anon
using (true)
with check (true);

create policy "Temporary anon delete during local development"
on public.class_schedules
for delete
to anon
using (true);
