create table if not exists public.enrollment_financial_records (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  provider text not null default 'conta_azul',
  provider_customer_id text,
  provider_receivable_id text,
  provider_payload jsonb,
  amount numeric(12,2),
  due_date date,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollment_financial_records_status_check check (
    status in (
      'pending',
      'customer_linked',
      'customer_created',
      'receivable_created',
      'failed',
      'skipped'
    )
  )
);

create index if not exists enrollment_financial_records_enrollment_id_idx
  on public.enrollment_financial_records (enrollment_id);

create index if not exists enrollment_financial_records_guardian_id_idx
  on public.enrollment_financial_records (guardian_id);

create index if not exists enrollment_financial_records_provider_idx
  on public.enrollment_financial_records (provider);

create index if not exists enrollment_financial_records_provider_customer_id_idx
  on public.enrollment_financial_records (provider_customer_id);

create index if not exists enrollment_financial_records_provider_receivable_id_idx
  on public.enrollment_financial_records (provider_receivable_id);

create index if not exists enrollment_financial_records_status_idx
  on public.enrollment_financial_records (status);

create trigger enrollment_financial_records_set_updated_at
before update on public.enrollment_financial_records
for each row execute function public.set_updated_at();

alter table public.enrollment_financial_records enable row level security;
