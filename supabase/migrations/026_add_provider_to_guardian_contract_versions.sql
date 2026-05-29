alter table public.guardian_financial_contract_versions
  add column if not exists provider text not null default 'conta_azul';

alter table public.guardian_financial_contract_versions
  drop constraint if exists guardian_financial_contract_versions_provider_check;

alter table public.guardian_financial_contract_versions
  add constraint guardian_financial_contract_versions_provider_check check (
    provider in ('conta_azul')
  );

create index if not exists guardian_financial_contract_versions_provider_idx
  on public.guardian_financial_contract_versions (provider);
