create table if not exists public.guardian_financial_contracts (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  provider text not null default 'conta_azul',
  year integer not null,
  status text not null default 'draft',
  provider_contract_id text,
  provider_sale_id text,
  total_amount numeric(12,2) not null default 0,
  start_date date not null,
  end_date date not null,
  first_due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_financial_contracts_provider_check check (
    provider in ('conta_azul')
  ),
  constraint guardian_financial_contracts_status_check check (
    status in ('draft', 'pending_sync', 'contract_created', 'failed', 'cancelled')
  ),
  constraint guardian_financial_contracts_year_check check (year >= 2000),
  constraint guardian_financial_contracts_date_range_check check (
    end_date >= start_date
  ),
  constraint guardian_financial_contracts_unique_guardian_provider_year unique (
    guardian_id,
    provider,
    year
  )
);

create table if not exists public.guardian_financial_contract_items (
  id uuid primary key default gen_random_uuid(),
  guardian_contract_id uuid not null references public.guardian_financial_contracts(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  status text not null default 'active',
  started_at date not null,
  ended_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_financial_contract_items_status_check check (
    status in ('active', 'cancelled', 'ended')
  ),
  constraint guardian_financial_contract_items_amount_positive check (amount > 0),
  constraint guardian_financial_contract_items_date_range_check check (
    ended_at >= started_at
  ),
  constraint guardian_financial_contract_items_unique_enrollment unique (
    enrollment_id
  )
);

create index if not exists guardian_financial_contracts_guardian_id_idx
  on public.guardian_financial_contracts (guardian_id);

create index if not exists guardian_financial_contracts_provider_year_idx
  on public.guardian_financial_contracts (provider, year);

create index if not exists guardian_financial_contracts_provider_contract_id_idx
  on public.guardian_financial_contracts (provider_contract_id);

create index if not exists guardian_financial_contract_items_contract_id_idx
  on public.guardian_financial_contract_items (guardian_contract_id);

create index if not exists guardian_financial_contract_items_enrollment_id_idx
  on public.guardian_financial_contract_items (enrollment_id);

drop trigger if exists guardian_financial_contracts_set_updated_at
  on public.guardian_financial_contracts;

create trigger guardian_financial_contracts_set_updated_at
before update on public.guardian_financial_contracts
for each row execute function public.set_updated_at();

drop trigger if exists guardian_financial_contract_items_set_updated_at
  on public.guardian_financial_contract_items;

create trigger guardian_financial_contract_items_set_updated_at
before update on public.guardian_financial_contract_items
for each row execute function public.set_updated_at();

alter table public.guardian_financial_contracts enable row level security;
alter table public.guardian_financial_contract_items enable row level security;
