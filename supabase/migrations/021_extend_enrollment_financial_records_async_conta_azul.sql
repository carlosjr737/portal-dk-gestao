alter table public.enrollment_financial_records
  add column if not exists provider_protocol_id text,
  add column if not exists external_reference text,
  add column if not exists processed_at timestamptz;

alter table public.enrollment_financial_records
  drop constraint if exists enrollment_financial_records_status_check;

alter table public.enrollment_financial_records
  add constraint enrollment_financial_records_status_check check (
    status in (
      'pending',
      'customer_linked',
      'customer_created',
      'processing',
      'receivable_created',
      'failed',
      'skipped'
    )
  );

create index if not exists enrollment_financial_records_provider_protocol_id_idx
  on public.enrollment_financial_records (provider_protocol_id);

create index if not exists enrollment_financial_records_external_reference_idx
  on public.enrollment_financial_records (external_reference);
