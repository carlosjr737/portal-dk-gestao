-- Temporary development policies allow anon access.
-- Replace these policies before production.

alter table public.enrollments
  add column if not exists end_date date,
  add column if not exists financial_guardian_id uuid references public.guardians(id),
  add column if not exists monthly_amount numeric(10, 2),
  add column if not exists discount_amount numeric(10, 2),
  add column if not exists discount_reason text,
  add column if not exists notes text;

create index if not exists idx_enrollments_financial_guardian_id
  on public.enrollments (financial_guardian_id);

create index if not exists idx_enrollments_end_date
  on public.enrollments (end_date);

alter table public.enrollments enable row level security;

create policy "Temporary anon select during local development"
on public.enrollments
for select
to anon
using (true);

create policy "Temporary anon insert during local development"
on public.enrollments
for insert
to anon
with check (true);

create policy "Temporary anon update during local development"
on public.enrollments
for update
to anon
using (true)
with check (true);

create policy "Temporary anon delete during local development"
on public.enrollments
for delete
to anon
using (true);
