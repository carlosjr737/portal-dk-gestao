// Matriz oficial PEDK - DNA Professor DK (13 pilares). Fonte da verdade: o
// sistema de análise (aula_aberta) que grava em teacher_dna_assessments.
// As keys batem com os "code" do pillar_scores gerado pela IA.
export const teacherDnaPillars = [
  {
    key: "presenca_autoridade",
    name: "Presença e autoridade",
    shortName: "Presença",
  },
  {
    key: "demonstracao_qualificada",
    name: "Demonstração qualificada",
    shortName: "Demonstração",
  },
  {
    key: "organizacao_espacial",
    name: "Organização espacial",
    shortName: "Espaço",
  },
  {
    key: "progressao_fluxo",
    name: "Progressão e fluxo",
    shortName: "Progressão",
  },
  {
    key: "correcao_impacto",
    name: "Correção com impacto",
    shortName: "Correção",
  },
  {
    key: "repeticao_produtiva",
    name: "Repetição produtiva",
    shortName: "Repetição",
  },
  {
    key: "musicalidade",
    name: "Musicalidade",
    shortName: "Musicalidade",
  },
  {
    key: "performance_palco",
    name: "Performance e palco",
    shortName: "Palco",
  },
  {
    key: "seguranca_emocional",
    name: "Segurança emocional",
    shortName: "Segurança",
  },
  {
    key: "adaptacao_contexto",
    name: "Adaptação ao contexto",
    shortName: "Adaptação",
  },
  {
    key: "observacao_elenco",
    name: "Observação e elenco",
    shortName: "Elenco",
  },
  {
    key: "diagnostico_individualizacao",
    name: "Diagnóstico e individualização",
    shortName: "Diagnóstico",
  },
  {
    key: "engajamento_divertido",
    name: "Engajamento e diversão",
    shortName: "Engajamento",
  },
] as const;

export type TeacherDnaPillarKey = (typeof teacherDnaPillars)[number]["key"];

export const teacherDnaPeriodOptions = [
  { value: "this_month", label: "Este mês" },
  { value: "last_30", label: "Últimos 30 dias" },
  { value: "last_90", label: "Últimos 90 dias" },
  { value: "this_year", label: "Este ano" },
] as const;

export type TeacherDnaPeriod = (typeof teacherDnaPeriodOptions)[number]["value"];

export const teacherDnaStatusOptions = [
  { value: "all", label: "Todos" },
  { value: "with_assessment", label: "Com avaliação" },
  { value: "without_assessment", label: "Sem avaliação" },
] as const;

export type TeacherDnaStatusFilter =
  (typeof teacherDnaStatusOptions)[number]["value"];
