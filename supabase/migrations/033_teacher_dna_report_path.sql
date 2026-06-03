-- DNA do Professor: relatório em PDF por aula.
--
-- O sistema externo de análise gera o PDF de cada aula e faz o upload para o
-- Storage do Supabase (bucket "dna-reports"), gravando o caminho do arquivo em
-- teacher_dna_assessments.report_path. O portal apenas lê esse caminho e gera
-- um link assinado para download. O portal NÃO gera PDFs.

-- 1) Coluna que aponta para o PDF já criado no Storage.
alter table public.teacher_dna_assessments
  add column if not exists report_path text null;

-- 2) Bucket privado onde o sistema de análise envia os relatórios.
insert into storage.buckets (id, name, public)
values ('dna-reports', 'dna-reports', false)
on conflict (id) do nothing;

-- 3) Usuários autenticados do portal podem ler os relatórios (para gerar o
--    link assinado de download). O upload é feito pelo sistema externo com a
--    service role key, que ignora RLS.
drop policy if exists "Authenticated can read dna reports" on storage.objects;
create policy "Authenticated can read dna reports"
on storage.objects
for select
to authenticated
using (bucket_id = 'dna-reports');

notify pgrst, 'reload schema';
