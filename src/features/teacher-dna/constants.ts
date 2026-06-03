export const teacherDnaPillars = [
  {
    key: "energia_presenca",
    name: "Energia e presença",
    shortName: "Energia",
  },
  {
    key: "clareza_conducao",
    name: "Clareza na condução",
    shortName: "Clareza",
  },
  {
    key: "dominio_tecnico",
    name: "Domínio técnico",
    shortName: "Técnica",
  },
  {
    key: "didatica",
    name: "Didática",
    shortName: "Didática",
  },
  {
    key: "correcao_alunos",
    name: "Correção dos alunos",
    shortName: "Correção",
  },
  {
    key: "gestao_turma",
    name: "Gestão da turma",
    shortName: "Gestão",
  },
  {
    key: "motivacao_engajamento",
    name: "Motivação e engajamento",
    shortName: "Engajamento",
  },
  {
    key: "conexao_alunos",
    name: "Conexão com os alunos",
    shortName: "Conexão",
  },
  {
    key: "organizacao_aula",
    name: "Organização da aula",
    shortName: "Organização",
  },
  {
    key: "ritmo_tempo",
    name: "Ritmo e aproveitamento do tempo",
    shortName: "Ritmo",
  },
  {
    key: "padrao_dk",
    name: "Alinhamento com o padrão DK",
    shortName: "Padrão DK",
  },
  {
    key: "evolucao_turma",
    name: "Evolução percebida da turma",
    shortName: "Evolução",
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
