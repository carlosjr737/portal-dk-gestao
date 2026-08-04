export type UserRole = "admin" | "equipe" | "professor";

export type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
  /** Escola (tenant) a que o usuário pertence. Fonte da verdade do multi-escola. */
  escolaId: string | null;
};

export const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  equipe: "Equipe",
  professor: "Professor",
};

export const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/metricas-escola", label: "Métricas da escola" },
  { href: "/metricas-publico", label: "Métricas do público" },
  { href: "/alunos", label: "Alunos" },
  { href: "/responsaveis", label: "Responsáveis" },
  { href: "/turmas", label: "Turmas" },
  { href: "/salas", label: "Salas" },
  { href: "/rodizio-salas", label: "Rodízio de Salas" },
  { href: "/professores", label: "Professores" },
  { href: "/modalidades", label: "Modalidades" },
  { href: "/niveis", label: "Níveis" },
  { href: "/matriculas", label: "Matrículas" },
  { href: "/chamada", label: "Chamada" },
  { href: "/calendario", label: "Calendário" },
  { href: "/dna-professores", label: "DNA do Professor" },
  { href: "/espetaculos", label: "Espetáculos" },
  { href: "/importar-alunos", label: "Importar alunos" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/financeiro/faturamento-turmas", label: "Faturamento por turma" },
  { href: "/financeiro/professores", label: "Financeiro dos professores" },
  { href: "/financeiro/recebimentos", label: "Recebimentos" },
  { href: "/financeiro/conta-pagamentos", label: "Conta de pagamentos" },
  { href: "/financeiro/inadimplencia", label: "Inadimplência" },
  { href: "/financeiro/growth-churn", label: "Growth & Churn" },
  { href: "/financeiro/entradas-saidas", label: "Entradas & Saídas" },
  { href: "/configuracoes", label: "Configurações" },
  { href: "/configuracoes/escola", label: "Minha escola" },
  { href: "/configuracoes/usuarios", label: "Usuários" },
  { href: "/configuracoes/pina-acessos", label: "Acessos ao Pina" },
] as const;

const roleRoutePrefixes: Record<UserRole, string[]> = {
  admin: ["/"],
  equipe: [
    "/dashboard",
    "/metricas-escola",
    "/metricas-publico",
    "/alunos",
    "/responsaveis",
    "/turmas",
    "/salas",
    "/rodizio-salas",
    "/matriculas",
    "/chamada",
    "/calendario",
    "/dna-professores",
    "/espetaculos",
    "/importar-alunos",
  ],
  professor: ["/dashboard", "/chamada", "/calendario", "/turmas"],
};

/**
 * Itens que o papel NÃO vê no menu, mesmo tendo permissão de rota.
 *
 * Existe para esconder tela que a pessoa pode abrir mas não é o caminho dela
 * (o professor acessa /dashboard, mas o dia dele começa na chamada).
 *
 * O que o menu mostra é sempre um SUBCONJUNTO do que a rota permite — a
 * navegação deriva das permissões, nunca é uma segunda lista. Antes eram duas
 * listas paralelas, e elas divergiram: o professor via "Rodízio de Salas" e
 * levava "acesso negado" ao clicar.
 */
const ocultosNoMenu: Record<UserRole, string[]> = {
  admin: [],
  equipe: [],
  professor: ["/dashboard"],
};

/**
 * Telas que só existem para escola com o módulo de pagamento ativo.
 *
 * Inadimplência só faz sentido para quem cobra PELO sistema: sem isso, o
 * sistema não tem como saber quem pagou. Escola que usa só a gestão não deve
 * nem ver a tela — melhor não oferecer do que oferecer vazia.
 *
 * As demais telas do Financeiro continuam valendo para todas: faturamento por
 * turma, pagamento de professores, Growth & Churn e entradas/saídas se apoiam
 * em matrícula e lançamento manual, não em cobrança.
 */
const exigemModuloFinanceiro = ["/financeiro/inadimplencia"];

export function exigeModuloFinanceiro(pathname: string): boolean {
  return exigemModuloFinanceiro.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "admin" || value === "equipe" || value === "professor";
}

export function canAccessPath(role: UserRole, pathname: string) {
  if (pathname === "/acesso-nao-autorizado") {
    return true;
  }

  return roleRoutePrefixes[role].some((prefix) => matchesPrefix(pathname, prefix));
}

export function getNavigationForRole(
  role: UserRole,
  usaModuloFinanceiro = true,
) {
  return navigationItems.filter(
    (item) =>
      canAccessPath(role, item.href) &&
      !ocultosNoMenu[role].some((prefix) => matchesPrefix(item.href, prefix)) &&
      (usaModuloFinanceiro || !exigeModuloFinanceiro(item.href)),
  );
}

/**
 * Para onde cada papel vai ao entrar.
 *
 * O professor caía em /dashboard — indicadores da escola inteira, e sem o
 * item no menu para voltar. O dia dele começa na chamada.
 */
export function getHomeForRole(role: UserRole): string {
  return role === "professor" ? "/chamada" : "/dashboard";
}

function matchesPrefix(pathname: string, prefix: string) {
  return prefix === "/" || pathname === prefix || pathname.startsWith(`${prefix}/`);
}
