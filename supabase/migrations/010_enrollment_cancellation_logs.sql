alter table public.enrollments
  add column if not exists cancellation_notes text;

create table if not exists public.enrollment_logs (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  student_id uuid references public.students(id),
  class_id uuid references public.classes(id),
  event_type text not null,
  reason text,
  notes text,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint enrollment_logs_event_type_check check (
    event_type in (
      'enrollment_created',
      'enrollment_cancelled',
      'enrollment_updated',
      'enrollment_reactivated',
      'class_changed'
    )
  )
);

create index if not exists idx_enrollment_logs_enrollment_id
  on public.enrollment_logs (enrollment_id);

create index if not exists idx_enrollment_logs_student_id
  on public.enrollment_logs (student_id);

create index if not exists idx_enrollment_logs_class_id
  on public.enrollment_logs (class_id);

create index if not exists idx_enrollment_logs_event_type
  on public.enrollment_logs (event_type);

create index if not exists idx_enrollment_logs_created_at
  on public.enrollment_logs (created_at);

alter table public.enrollment_logs enable row level security;

create policy "Temporary anon select during local development"
on public.enrollment_logs
for select
to anon
using (true);

create policy "Temporary anon insert during local development"
on public.enrollment_logs
for insert
to anon
with check (true);

create policy "Temporary anon update during local development"
on public.enrollment_logs
for update
to anon
using (true)
with check (true);

create policy "Temporary anon delete during local development"
on public.enrollment_logs
for delete
to anon
using (true);
