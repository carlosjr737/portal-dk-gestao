-- Temporary development policies allow anon access.
-- Replace these policies before production.

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  artistic_name text,
  email text,
  phone text,
  role text not null default 'professor',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_members_full_name_not_empty check (length(trim(full_name)) > 0),
  constraint staff_members_role_check check (
    role in ('professor', 'coordenador', 'financeiro', 'secretaria', 'admin')
  ),
  constraint staff_members_status_check check (status in ('active', 'inactive'))
);

create index if not exists idx_staff_members_role
  on public.staff_members (role);

create index if not exists idx_staff_members_status
  on public.staff_members (status);

create index if not exists idx_staff_members_full_name
  on public.staff_members (full_name);

create trigger staff_members_set_updated_at
before update on public.staff_members
for each row execute function public.set_updated_at();

alter table public.staff_members enable row level security;

create policy "Temporary anon select during local development"
on public.staff_members
for select
to anon
using (true);

create policy "Temporary anon insert during local development"
on public.staff_members
for insert
to anon
with check (true);

create policy "Temporary anon update during local development"
on public.staff_members
for update
to anon
using (true)
with check (true);

create policy "Temporary anon delete during local development"
on public.staff_members
for delete
to anon
using (true);

alter table public.classes
  add column if not exists teacher_id uuid references public.staff_members(id);

create index if not exists classes_teacher_id_idx
  on public.classes (teacher_id);
