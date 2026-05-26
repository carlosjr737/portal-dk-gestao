create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  google_email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  calendar_id text,
  status text default 'connected',
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists google_calendar_connections_user_id_idx
  on public.google_calendar_connections (user_id);

create index if not exists google_calendar_connections_status_idx
  on public.google_calendar_connections (status);

create trigger google_calendar_connections_set_updated_at
before update on public.google_calendar_connections
for each row execute function public.set_updated_at();

alter table public.google_calendar_connections enable row level security;
