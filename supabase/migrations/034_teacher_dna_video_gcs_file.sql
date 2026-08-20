-- Caminho do vídeo da aula no GCS (bucket dk-aula-aberta-videos), gravado pelo
-- sistema externo de análise. O Portal usa isso para gerar um link temporário
-- de download do vídeo, ao lado do relatório PDF.
alter table public.teacher_dna_assessments
  add column if not exists video_gcs_file text null;

notify pgrst, 'reload schema';
