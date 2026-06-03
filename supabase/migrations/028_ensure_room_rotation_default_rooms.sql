create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  capacity integer null,
  color text null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.rooms (name, slug, color, sort_order, active)
values
  ('Subway', 'subway', '#dbeafe', 1, true),
  ('Pequena', 'pequena', '#dcfce7', 2, true),
  ('Aquário', 'aquario', '#fef3c7', 3, true),
  ('Mirante', 'mirante', '#fce7f3', 4, true)
on conflict (slug) do update
set
  name = excluded.name,
  color = excluded.color,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

create index if not exists idx_rooms_active_sort
on public.rooms (active, sort_order);

alter table public.rooms enable row level security;

drop policy if exists "rooms_select_authenticated" on public.rooms;
create policy "rooms_select_authenticated"
on public.rooms
for select
to authenticated
using (true);

drop policy if exists "rooms_manage_authenticated" on public.rooms;
create policy "rooms_manage_authenticated"
on public.rooms
for all
to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
