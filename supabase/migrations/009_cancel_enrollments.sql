alter type public.enrollment_status add value if not exists 'cancelled';

alter table public.enrollments
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz;

create index if not exists idx_enrollments_cancelled_at
  on public.enrollments (cancelled_at);
