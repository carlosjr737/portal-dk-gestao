alter table public.guardian_financial_contracts
  add column if not exists provider_customer_id text,
  add column if not exists provider_legacy_id text,
  add column if not exists version integer not null default 1,
  add column if not exists previous_contract_id uuid references public.guardian_financial_contracts(id) on delete set null,
  add column if not exists replaced_by_contract_id uuid references public.guardian_financial_contracts(id) on delete set null,
  add column if not exists provider_closed_at timestamptz,
  add column if not exists closed_reason text,
  add column if not exists effective_from date,
  add column if not exists effective_until date,
  add column if not exists contract_payload jsonb,
  add column if not exists last_sync_payload jsonb,
  add column if not exists error_message text;

alter table public.guardian_financial_contracts
  drop constraint if exists guardian_financial_contracts_status_check;

alter table public.guardian_financial_contracts
  add constraint guardian_financial_contracts_status_check check (
    status in (
      'draft',
      'active',
      'pending_sync',
      'pending_replacement',
      'sync_failed',
      'closed',
      'cancelled',
      'replaced'
    )
  );

create index if not exists guardian_financial_contracts_previous_contract_id_idx
  on public.guardian_financial_contracts (previous_contract_id);

create index if not exists guardian_financial_contracts_replaced_by_contract_id_idx
  on public.guardian_financial_contracts (replaced_by_contract_id);

create table if not exists public.guardian_financial_contract_versions (
  id uuid primary key default gen_random_uuid(),
  guardian_contract_id uuid not null references public.guardian_financial_contracts(id) on delete cascade,
  provider_contract_id text,
  provider_legacy_id text,
  version integer not null,
  status text not null,
  total_amount numeric(12,2) not null default 0,
  started_at date,
  ended_at date,
  closed_at timestamptz,
  close_reason text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guardian_financial_contract_versions_contract_id_idx
  on public.guardian_financial_contract_versions (guardian_contract_id);

create index if not exists guardian_financial_contract_versions_provider_contract_id_idx
  on public.guardian_financial_contract_versions (provider_contract_id);

drop trigger if exists guardian_financial_contract_versions_set_updated_at
  on public.guardian_financial_contract_versions;

create trigger guardian_financial_contract_versions_set_updated_at
before update on public.guardian_financial_contract_versions
for each row execute function public.set_updated_at();

alter table public.guardian_financial_contract_versions enable row level security;
