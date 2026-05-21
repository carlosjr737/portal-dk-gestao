-- Portal DK Gestao - initial Supabase schema
-- RLS is enabled with permissive authenticated policies for initial development.

create extension if not exists "pgcrypto";

create type public.student_status as enum (
  'active',
  'inactive',
  'evaluation'
);

create type public.class_status as enum (
  'active',
  'inactive',
  'planning'
);

create type public.enrollment_status as enum (
  'active',
  'paused',
  'ended',
  'evaluation'
);

create type public.payment_status as enum (
  'pending',
  'paid',
  'overdue',
  'canceled',
  'refunded'
);

create type public.user_role as enum (
  'admin',
  'staff',
  'viewer'
);

create type public.audit_action as enum (
  'insert',
  'update',
  'delete',
  'login',
  'other'
);

create type public.guardian_relationship_type as enum (
  'mother',
  'father',
  'family',
  'financial',
  'pedagogical',
  'emergency',
  'other'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text not null unique,
  role public.user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_full_name_not_empty check (length(trim(full_name)) > 0),
  constraint users_email_not_empty check (length(trim(email)) > 0),
  constraint users_email_lowercase check (email = lower(email))
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  display_name text,
  birth_date date,
  document text,
  phone text,
  email text,
  status public.student_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_full_name_not_empty check (length(trim(full_name)) > 0),
  constraint students_email_format check (
    email is null
    or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  document text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardians_full_name_not_empty check (length(trim(full_name)) > 0),
  constraint guardians_email_format check (
    email is null
    or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship_type public.guardian_relationship_type,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_guardians_unique_pair unique (student_id, guardian_id)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  instructor_name text,
  room text,
  weekdays text[] not null default '{}',
  start_time time,
  end_time time,
  age_range text,
  level text,
  schedule_description text,
  capacity integer,
  status public.class_status not null default 'planning',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_name_not_empty check (length(trim(name)) > 0),
  constraint classes_capacity_positive check (capacity is null or capacity > 0),
  constraint classes_valid_time_range check (
    start_time is null
    or end_time is null
    or end_time > start_time
  )
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  status public.enrollment_status not null default 'active',
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_valid_dates check (
    start_date is null
    or end_date is null
    or end_date >= start_date
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  guardian_id uuid references public.guardians(id) on delete set null,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  amount_cents integer not null,
  due_date date not null,
  paid_at timestamptz,
  status public.payment_status not null default 'pending',
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount_cents > 0),
  constraint payments_paid_at_required_when_paid check (
    status <> 'paid'
    or paid_at is not null
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null,
  action public.audit_action not null default 'other',
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_table_name_not_empty check (
    table_name is null
    or length(trim(table_name)) > 0
  )
);

create unique index students_document_unique_idx
  on public.students (document)
  where document is not null and length(trim(document)) > 0;

create unique index guardians_document_unique_idx
  on public.guardians (document)
  where document is not null and length(trim(document)) > 0;

create unique index student_guardians_one_primary_per_student_idx
  on public.student_guardians (student_id)
  where is_primary = true;

create unique index enrollments_unique_active_student_class_idx
  on public.enrollments (student_id, class_id)
  where status = 'active';

create index users_auth_user_id_idx on public.users (auth_user_id);
create index users_email_idx on public.users (email);
create index users_role_idx on public.users (role);

create index students_full_name_idx on public.students (full_name);
create index students_status_idx on public.students (status);
create index students_email_idx on public.students (email);

create index guardians_full_name_idx on public.guardians (full_name);
create index guardians_email_idx on public.guardians (email);

create index student_guardians_student_id_idx on public.student_guardians (student_id);
create index student_guardians_guardian_id_idx on public.student_guardians (guardian_id);

create index classes_name_idx on public.classes (name);
create index classes_status_idx on public.classes (status);
create index classes_category_idx on public.classes (category);
create index classes_room_idx on public.classes (room);
create index classes_level_idx on public.classes (level);

create index enrollments_student_id_idx on public.enrollments (student_id);
create index enrollments_class_id_idx on public.enrollments (class_id);
create index enrollments_status_idx on public.enrollments (status);

create index payments_student_id_idx on public.payments (student_id);
create index payments_guardian_id_idx on public.payments (guardian_id);
create index payments_enrollment_id_idx on public.payments (enrollment_id);
create index payments_status_idx on public.payments (status);
create index payments_due_date_idx on public.payments (due_date);

create index audit_logs_user_id_idx on public.audit_logs (user_id);
create index audit_logs_auth_user_id_idx on public.audit_logs (auth_user_id);
create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger guardians_set_updated_at
before update on public.guardians
for each row execute function public.set_updated_at();

create trigger student_guardians_set_updated_at
before update on public.student_guardians
for each row execute function public.set_updated_at();

create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

create policy "Allow authenticated users during initial development"
on public.users
for all
to authenticated
using (true)
with check (true);

create policy "Allow authenticated users during initial development"
on public.students
for all
to authenticated
using (true)
with check (true);

create policy "Allow authenticated users during initial development"
on public.guardians
for all
to authenticated
using (true)
with check (true);

create policy "Allow authenticated users during initial development"
on public.student_guardians
for all
to authenticated
using (true)
with check (true);

create policy "Allow authenticated users during initial development"
on public.classes
for all
to authenticated
using (true)
with check (true);

create policy "Allow authenticated users during initial development"
on public.enrollments
for all
to authenticated
using (true)
with check (true);

create policy "Allow authenticated users during initial development"
on public.payments
for all
to authenticated
using (true)
with check (true);

create policy "Allow authenticated users during initial development"
on public.audit_logs
for all
to authenticated
using (true)
with check (true);
