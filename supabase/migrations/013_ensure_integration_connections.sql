create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'integration_connections_provider_key'
      and conrelid = 'public.integration_connections'::regclass
  ) then
    alter table public.integration_connections
      add constraint integration_connections_provider_key unique (provider);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'integration_connections_provider_check'
      and conrelid = 'public.integration_connections'::regclass
  ) then
    alter table public.integration_connections
      add constraint integration_connections_provider_check
      check (provider in ('conta_azul'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'integration_connections_status_check'
      and conrelid = 'public.integration_connections'::regclass
  ) then
    alter table public.integration_connections
      add constraint integration_connections_status_check
      check (status in ('connected', 'expired', 'disconnected'));
  end if;
end $$;

create unique index if not exists integration_connections_provider_unique
  on public.integration_connections (provider);

create index if not exists idx_integration_connections_status
  on public.integration_connections (status);

drop trigger if exists integration_connections_set_updated_at
  on public.integration_connections;

create trigger integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function public.set_updated_at();

alter table public.integration_connections enable row level security;

-- Tokens are sensitive. In production, keep this table protected and access it
-- only from server-side code with SUPABASE_SERVICE_ROLE_KEY.
-- Do not expose access_token or refresh_token through anon/client policies.

notify pgrst, 'reload schema';
