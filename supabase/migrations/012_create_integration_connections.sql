create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_provider_check check (
    provider in ('conta_azul')
  ),
  constraint integration_connections_status_check check (
    status in ('connected', 'expired', 'disconnected')
  )
);

create unique index if not exists integration_connections_provider_unique
  on public.integration_connections (provider);

create index if not exists idx_integration_connections_status
  on public.integration_connections (status);

create trigger integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function public.set_updated_at();

alter table public.integration_connections enable row level security;

-- Tokens are sensitive. Do not create anon policies for this table.
-- Server-side code must access it with SUPABASE_SERVICE_ROLE_KEY only.
