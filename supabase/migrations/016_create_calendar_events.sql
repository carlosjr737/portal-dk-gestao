create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  all_day boolean not null default true,
  affects_classes boolean not null default false,
  affects_all_classes boolean not null default false,
  class_id uuid references public.classes(id) on delete set null,
  teacher_id uuid references public.staff_members(id) on delete set null,
  modality_id uuid references public.modalities(id) on delete set null,
  level_id uuid references public.levels(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_type_check check (
    event_type in (
      'feriado',
      'recesso',
      'evento',
      'ensaio',
      'espetaculo',
      'aula_suspensa',
      'reposicao',
      'outro'
    )
  ),
  constraint calendar_events_date_range_check check (end_date >= start_date),
  constraint calendar_events_time_range_check check (
    start_time is null or end_time is null or end_time > start_time
  )
);

create index if not exists calendar_events_start_date_idx
  on public.calendar_events (start_date);

create index if not exists calendar_events_end_date_idx
  on public.calendar_events (end_date);

create index if not exists calendar_events_event_type_idx
  on public.calendar_events (event_type);

create index if not exists calendar_events_affects_classes_idx
  on public.calendar_events (affects_classes);

create index if not exists calendar_events_class_id_idx
  on public.calendar_events (class_id);

create index if not exists calendar_events_teacher_id_idx
  on public.calendar_events (teacher_id);

create index if not exists calendar_events_modality_id_idx
  on public.calendar_events (modality_id);

create index if not exists calendar_events_level_id_idx
  on public.calendar_events (level_id);

create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;
