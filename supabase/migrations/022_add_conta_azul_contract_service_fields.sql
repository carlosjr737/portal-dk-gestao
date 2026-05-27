alter table public.finance_provider_settings
  add column if not exists conta_azul_service_item_id text,
  add column if not exists conta_azul_service_item_name text;

alter table public.enrollment_financial_records
  add column if not exists provider_contract_id text,
  add column if not exists provider_sale_id text,
  add column if not exists contract_payload jsonb,
  add column if not exists contract_started_at date,
  add column if not exists contract_ends_at date;

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
      'contract_created',
      'failed',
      'skipped'
    )
  );

create index if not exists enrollment_financial_records_provider_contract_id_idx
  on public.enrollment_financial_records (provider_contract_id);

create index if not exists enrollment_financial_records_provider_sale_id_idx
  on public.enrollment_financial_records (provider_sale_id);
