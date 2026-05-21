-- Temporary development policies allow anon access.
-- Replace these policies before production.

create table if not exists public.modalities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modalities_name_not_empty check (length(trim(name)) > 0),
  constraint modalities_status_check check (status in ('active', 'inactive'))
);

create unique index if not exists modalities_name_unique_lower
  on public.modalities (lower(name));

create index if not exists idx_modalities_status
  on public.modalities (status);

create index if not exists idx_modalities_name
  on public.modalities (name);

create index if not exists idx_modalities_sort_order
  on public.modalities (sort_order);

create trigger modalities_set_updated_at
before update on public.modalities
for each row execute function public.set_updated_at();

alter table public.modalities enable row level security;

create policy "Temporary anon select during local development"
on public.modalities
for select
to anon
using (true);

create policy "Temporary anon insert during local development"
on public.modalities
for insert
to anon
with check (true);

create policy "Temporary anon update during local development"
on public.modalities
for update
to anon
using (true)
with check (true);

create policy "Temporary anon delete during local development"
on public.modalities
for delete
to anon
using (true);

create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint levels_name_not_empty check (length(trim(name)) > 0),
  constraint levels_status_check check (status in ('active', 'inactive'))
);

create unique index if not exists levels_name_unique_lower
  on public.levels (lower(name));

create index if not exists idx_levels_status
  on public.levels (status);

create index if not exists idx_levels_name
  on public.levels (name);

create index if not exists idx_levels_sort_order
  on public.levels (sort_order);

create trigger levels_set_updated_at
before update on public.levels
for each row execute function public.set_updated_at();

alter table public.levels enable row level security;

create policy "Temporary anon select during local development"
on public.levels
for select
to anon
using (true);

create policy "Temporary anon insert during local development"
on public.levels
for insert
to anon
with check (true);

create policy "Temporary anon update during local development"
on public.levels
for update
to anon
using (true)
with check (true);

create policy "Temporary anon delete during local development"
on public.levels
for delete
to anon
using (true);

alter table public.classes
  add column if not exists modality_id uuid references public.modalities(id),
  add column if not exists level_id uuid references public.levels(id);

create index if not exists idx_classes_modality_id
  on public.classes (modality_id);

create index if not exists idx_classes_level_id
  on public.classes (level_id);

notify pgrst, 'reload schema';
