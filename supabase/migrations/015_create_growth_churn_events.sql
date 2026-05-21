create table if not exists public.churn_reasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.churn_reasons (name)
values
  ('Mudança de Interesses ou Desmotivação'),
  ('Prioridades Acadêmicas/Estudos'),
  ('Compromissos com Outros Esportes'),
  ('Motivos Financeiros'),
  ('Motivos de Saúde/Fisioterapia'),
  ('Incompatibilidade de Horários'),
  ('Mudança de Localidade/Logística'),
  ('Atendimento/Experiência'),
  ('Outros')
on conflict (name) do nothing;

create table if not exists public.growth_churn_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('entrada', 'saida')),
  student_id uuid references public.students(id) on delete set null,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  teacher_id uuid references public.staff_members(id) on delete set null,
  modality_id uuid references public.modalities(id) on delete set null,
  level_id uuid references public.levels(id) on delete set null,
  event_date date not null default current_date,
  monthly_amount numeric(12, 2),
  reason_id uuid references public.churn_reasons(id) on delete set null,
  reason_notes text,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists growth_churn_events_event_type_idx
  on public.growth_churn_events (event_type);

create index if not exists growth_churn_events_event_date_idx
  on public.growth_churn_events (event_date);

create index if not exists growth_churn_events_student_id_idx
  on public.growth_churn_events (student_id);

create index if not exists growth_churn_events_enrollment_id_idx
  on public.growth_churn_events (enrollment_id);

create index if not exists growth_churn_events_class_id_idx
  on public.growth_churn_events (class_id);

create index if not exists growth_churn_events_teacher_id_idx
  on public.growth_churn_events (teacher_id);

create index if not exists growth_churn_events_modality_id_idx
  on public.growth_churn_events (modality_id);

create index if not exists growth_churn_events_level_id_idx
  on public.growth_churn_events (level_id);

create index if not exists growth_churn_events_reason_id_idx
  on public.growth_churn_events (reason_id);

create unique index if not exists growth_churn_events_unique_entrada_enrollment_idx
  on public.growth_churn_events (enrollment_id)
  where event_type = 'entrada' and enrollment_id is not null;

create unique index if not exists growth_churn_events_unique_saida_enrollment_idx
  on public.growth_churn_events (enrollment_id)
  where event_type = 'saida' and enrollment_id is not null;
