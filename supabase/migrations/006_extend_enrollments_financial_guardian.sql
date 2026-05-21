alter table public.enrollments
  add column if not exists end_date date,
  add column if not exists financial_guardian_id uuid references public.guardians(id),
  add column if not exists monthly_amount numeric(10, 2),
  add column if not exists discount_amount numeric(10, 2),
  add column if not exists discount_reason text;

alter table public.enrollments
  drop constraint if exists enrollments_valid_dates;

alter table public.enrollments
  add constraint enrollments_valid_dates check (
    start_date is null
    or end_date is null
    or end_date >= start_date
  );

alter table public.enrollments
  add constraint enrollments_monthly_amount_non_negative check (
    monthly_amount is null
    or monthly_amount >= 0
  );

alter table public.enrollments
  add constraint enrollments_discount_amount_non_negative check (
    discount_amount is null
    or discount_amount >= 0
  );

create index if not exists idx_enrollments_financial_guardian_id
  on public.enrollments (financial_guardian_id);

create index if not exists idx_enrollments_end_date
  on public.enrollments (end_date);
