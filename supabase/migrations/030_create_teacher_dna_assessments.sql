create table if not exists public.teacher_dna_assessments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.staff_members(id) on delete cascade,
  class_id uuid null references public.classes(id) on delete set null,
  lesson_date date null,
  source text not null default 'manual',
  overall_score numeric not null default 0,
  pillar_scores jsonb not null default '{}'::jsonb,
  strengths text[] null,
  improvements text[] null,
  summary text null,
  raw_payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teacher_dna_assessments_teacher
on public.teacher_dna_assessments (teacher_id);

create index if not exists idx_teacher_dna_assessments_lesson_date
on public.teacher_dna_assessments (lesson_date);

create index if not exists idx_teacher_dna_assessments_class
on public.teacher_dna_assessments (class_id);

alter table public.teacher_dna_assessments enable row level security;

drop policy if exists "teacher_dna_assessments_select_authenticated"
on public.teacher_dna_assessments;
create policy "teacher_dna_assessments_select_authenticated"
on public.teacher_dna_assessments
for select
to authenticated
using (true);

drop policy if exists "teacher_dna_assessments_insert_authenticated"
on public.teacher_dna_assessments;
create policy "teacher_dna_assessments_insert_authenticated"
on public.teacher_dna_assessments
for insert
to authenticated
with check (true);

drop policy if exists "teacher_dna_assessments_update_authenticated"
on public.teacher_dna_assessments;
create policy "teacher_dna_assessments_update_authenticated"
on public.teacher_dna_assessments
for update
to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
