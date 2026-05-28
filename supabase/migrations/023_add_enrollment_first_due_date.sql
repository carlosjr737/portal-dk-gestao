alter table public.enrollments
  add column if not exists first_due_date date;

create index if not exists idx_enrollments_first_due_date
  on public.enrollments (first_due_date);
