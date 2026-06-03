create table if not exists public.room_rotation_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null,
  month integer not null,
  day_group text not null,
  rotation_label text not null,
  status text not null default 'draft',
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_room_rotation_plans_unique
on public.room_rotation_plans (year, month, day_group, rotation_label);

create table if not exists public.room_rotation_assignments (
  id uuid primary key default gen_random_uuid(),
  rotation_plan_id uuid not null references public.room_rotation_plans(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  room_id uuid not null references public.rooms(id),
  start_time time not null,
  end_time time null,
  day_group text not null,
  sort_order integer not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_room_rotation_assignments_unique_class_plan
on public.room_rotation_assignments (rotation_plan_id, class_id);

create index if not exists idx_room_rotation_assignments_plan
on public.room_rotation_assignments (rotation_plan_id);

create index if not exists idx_room_rotation_assignments_room_time
on public.room_rotation_assignments (rotation_plan_id, room_id, start_time);

alter table public.room_rotation_plans enable row level security;
alter table public.room_rotation_assignments enable row level security;

drop policy if exists "room_rotation_plans_select_authenticated"
on public.room_rotation_plans;
create policy "room_rotation_plans_select_authenticated"
on public.room_rotation_plans
for select
to authenticated
using (true);

drop policy if exists "room_rotation_plans_insert_authenticated"
on public.room_rotation_plans;
create policy "room_rotation_plans_insert_authenticated"
on public.room_rotation_plans
for insert
to authenticated
with check (true);

drop policy if exists "room_rotation_plans_update_authenticated"
on public.room_rotation_plans;
create policy "room_rotation_plans_update_authenticated"
on public.room_rotation_plans
for update
to authenticated
using (true)
with check (true);

drop policy if exists "room_rotation_assignments_select_authenticated"
on public.room_rotation_assignments;
create policy "room_rotation_assignments_select_authenticated"
on public.room_rotation_assignments
for select
to authenticated
using (true);

drop policy if exists "room_rotation_assignments_insert_authenticated"
on public.room_rotation_assignments;
create policy "room_rotation_assignments_insert_authenticated"
on public.room_rotation_assignments
for insert
to authenticated
with check (true);

drop policy if exists "room_rotation_assignments_update_authenticated"
on public.room_rotation_assignments;
create policy "room_rotation_assignments_update_authenticated"
on public.room_rotation_assignments
for update
to authenticated
using (true)
with check (true);

drop policy if exists "room_rotation_assignments_delete_authenticated"
on public.room_rotation_assignments;
create policy "room_rotation_assignments_delete_authenticated"
on public.room_rotation_assignments
for delete
to authenticated
using (true);

notify pgrst, 'reload schema';
