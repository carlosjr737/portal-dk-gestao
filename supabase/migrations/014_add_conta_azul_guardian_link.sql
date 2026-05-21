alter table public.guardians
  add column if not exists conta_azul_person_id text,
  add column if not exists conta_azul_last_sync_at timestamptz;

create index if not exists guardians_conta_azul_person_id_idx
  on public.guardians (conta_azul_person_id)
  where conta_azul_person_id is not null and length(trim(conta_azul_person_id)) > 0;

create index if not exists guardians_document_idx
  on public.guardians (document)
  where document is not null and length(trim(document)) > 0;
