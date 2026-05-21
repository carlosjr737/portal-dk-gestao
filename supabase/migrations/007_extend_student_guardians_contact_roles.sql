alter table public.student_guardians
  add column if not exists relationship text,
  add column if not exists is_financial_responsible boolean not null default false,
  add column if not exists is_primary_contact boolean not null default false,
  add column if not exists is_emergency_contact boolean not null default false;

update public.student_guardians
set relationship = relationship_type::text
where relationship is null
  and relationship_type is not null;

update public.student_guardians
set is_primary_contact = true
where is_primary = true
  and is_primary_contact = false;

create index if not exists idx_student_guardians_student_id
  on public.student_guardians (student_id);

create index if not exists idx_student_guardians_guardian_id
  on public.student_guardians (guardian_id);

create index if not exists idx_student_guardians_financial
  on public.student_guardians (student_id, guardian_id)
  where is_financial_responsible = true;
