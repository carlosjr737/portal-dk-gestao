create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  capacity integer,
  color text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_name_not_empty check (length(trim(name)) > 0),
  constraint rooms_capacity_positive check (capacity is null or capacity > 0)
);

create table if not exists public.room_rotation_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null,
  month integer not null,
  day_group text not null,
  rotation_label text not null,
  status text not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_rotation_plans_name_not_empty check (length(trim(name)) > 0),
  constraint room_rotation_plans_year_check check (year >= 2000),
  constraint room_rotation_plans_month_check check (month between 1 and 12),
  constraint room_rotation_plans_day_group_check check (
    day_group in ('SEG_QUA', 'TER_QUI', 'SEX', 'SAB')
  ),
  constraint room_rotation_plans_status_check check (
    status in ('draft', 'published', 'archived')
  ),
  constraint room_rotation_plans_unique_filter unique (
    year,
    month,
    day_group,
    rotation_label
  )
);

create table if not exists public.room_rotation_assignments (
  id uuid primary key default gen_random_uuid(),
  rotation_plan_id uuid not null references public.room_rotation_plans(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  room_id uuid not null references public.rooms(id),
  start_time time not null,
  end_time time,
  day_group text not null,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_rotation_assignments_day_group_check check (
    day_group in ('SEG_QUA', 'TER_QUI', 'SEX', 'SAB')
  ),
  constraint room_rotation_assignments_time_range_check check (
    end_time is null or end_time > start_time
  ),
  constraint room_rotation_assignments_unique_room_time unique (
    rotation_plan_id,
    room_id,
    start_time
  ),
  constraint room_rotation_assignments_unique_class unique (
    rotation_plan_id,
    class_id
  )
);

create index if not exists rooms_active_sort_order_idx
  on public.rooms (active, sort_order);

create index if not exists room_rotation_plans_filter_idx
  on public.room_rotation_plans (year, month, day_group, rotation_label);

create index if not exists room_rotation_plans_status_idx
  on public.room_rotation_plans (status);

create index if not exists room_rotation_assignments_plan_idx
  on public.room_rotation_assignments (rotation_plan_id);

create index if not exists room_rotation_assignments_class_idx
  on public.room_rotation_assignments (class_id);

create index if not exists room_rotation_assignments_room_time_idx
  on public.room_rotation_assignments (room_id, start_time);

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

drop trigger if exists room_rotation_plans_set_updated_at
  on public.room_rotation_plans;
create trigger room_rotation_plans_set_updated_at
before update on public.room_rotation_plans
for each row execute function public.set_updated_at();

drop trigger if exists room_rotation_assignments_set_updated_at
  on public.room_rotation_assignments;
create trigger room_rotation_assignments_set_updated_at
before update on public.room_rotation_assignments
for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;
alter table public.room_rotation_plans enable row level security;
alter table public.room_rotation_assignments enable row level security;

drop policy if exists "Allow authenticated users to read rooms"
  on public.rooms;
create policy "Allow authenticated users to read rooms"
on public.rooms
for select
to authenticated
using (true);

drop policy if exists "Allow authenticated users to manage rooms"
  on public.rooms;
create policy "Allow authenticated users to manage rooms"
on public.rooms
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Allow authenticated users to read room rotation plans"
  on public.room_rotation_plans;
create policy "Allow authenticated users to read room rotation plans"
on public.room_rotation_plans
for select
to authenticated
using (true);

drop policy if exists "Allow authenticated users to manage room rotation plans"
  on public.room_rotation_plans;
create policy "Allow authenticated users to manage room rotation plans"
on public.room_rotation_plans
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Allow authenticated users to read room rotation assignments"
  on public.room_rotation_assignments;
create policy "Allow authenticated users to read room rotation assignments"
on public.room_rotation_assignments
for select
to authenticated
using (true);

drop policy if exists "Allow authenticated users to manage room rotation assignments"
  on public.room_rotation_assignments;
create policy "Allow authenticated users to manage room rotation assignments"
on public.room_rotation_assignments
for all
to authenticated
using (true)
with check (true);

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
  active = excluded.active,
  updated_at = now();

notify pgrst, 'reload schema';
