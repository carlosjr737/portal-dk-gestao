create table if not exists public.finance_provider_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  conta_azul_financial_account_id text,
  conta_azul_financial_account_name text,
  conta_azul_revenue_category_id text,
  conta_azul_revenue_category_name text,
  default_due_day integer,
  auto_create_receivable_on_enrollment boolean not null default false,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_provider_settings_provider_check check (
    provider in ('conta_azul')
  ),
  constraint finance_provider_settings_default_due_day_check check (
    default_due_day is null
    or (default_due_day >= 1 and default_due_day <= 31)
  )
);

alter table public.finance_provider_settings
  add column if not exists conta_azul_financial_account_id text,
  add column if not exists conta_azul_financial_account_name text,
  add column if not exists conta_azul_revenue_category_id text,
  add column if not exists conta_azul_revenue_category_name text,
  add column if not exists default_due_day integer,
  add column if not exists auto_create_receivable_on_enrollment boolean not null default false,
  add column if not exists active boolean not null default false;

create unique index if not exists finance_provider_settings_provider_unique
  on public.finance_provider_settings (provider);

drop trigger if exists finance_provider_settings_set_updated_at
  on public.finance_provider_settings;

create trigger finance_provider_settings_set_updated_at
before update on public.finance_provider_settings
for each row execute function public.set_updated_at();

alter table public.finance_provider_settings enable row level security;

-- Configuracoes financeiras controlam escrita externa.
-- Server-side code must access it with SUPABASE_SERVICE_ROLE_KEY only.
