-- Correção: a tabela public.staff_members (tabela oficial de professores/equipe)
-- só tinha políticas RLS para o role "anon" (ver migration 005). O portal lê os
-- dados com o cliente SSR autenticado (role "authenticated"), então o RLS
-- devolvia lista vazia silenciosamente -> /professores mostrava
-- "Nenhum professor cadastrado" mesmo havendo professores migrados.
--
-- Esta migration espelha as políticas para o role authenticated, mantendo as
-- políticas anon de desenvolvimento. Também garante unicidade por nome e
-- vincula turmas legadas que ainda usam instructor_name (texto).

-- 1) Políticas para usuários autenticados (idempotentes).
drop policy if exists "Authenticated can select staff members" on public.staff_members;
create policy "Authenticated can select staff members"
on public.staff_members
for select
to authenticated
using (true);

drop policy if exists "Authenticated can insert staff members" on public.staff_members;
create policy "Authenticated can insert staff members"
on public.staff_members
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can update staff members" on public.staff_members;
create policy "Authenticated can update staff members"
on public.staff_members
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can delete staff members" on public.staff_members;
create policy "Authenticated can delete staff members"
on public.staff_members
for delete
to authenticated
using (true);

-- 2) Unicidade por nome (case-insensitive) para evitar professores duplicados.
create unique index if not exists staff_members_full_name_lower_unique_idx
  on public.staff_members (lower(full_name));

-- 3) Backfill: vincular turmas que ainda têm apenas instructor_name (texto)
--    ao staff_members correspondente, sem sobrescrever vínculos existentes.
update public.classes c
set teacher_id = s.id
from public.staff_members s
where c.teacher_id is null
  and c.instructor_name is not null
  and length(trim(c.instructor_name)) > 0
  and (
    lower(trim(c.instructor_name)) = lower(trim(s.full_name))
    or lower(trim(c.instructor_name)) = lower(trim(coalesce(s.artistic_name, '')))
  );

notify pgrst, 'reload schema';
