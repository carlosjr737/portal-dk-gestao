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

export const CATEGORIAS = [
  { chave: "visao", nome: "Visão geral" },
  { chave: "pessoas", nome: "Pessoas" },
  { chave: "ensino", nome: "Ensino" },
  { chave: "espaco", nome: "Espaço" },
  { chave: "financeiro", nome: "Financeiro" },
  { chave: "config", nome: "Configurações" },
] as const;

export type Categoria = (typeof CATEGORIAS)[number]["chave"];

export const navigationItems = [
  { href: "/dashboard", label: "Dashboard", categoria: "visao" },
  { href: "/metricas-escola", label: "Métricas da escola", categoria: "visao" },
  { href: "/metricas-publico", label: "Métricas do público", categoria: "visao" },
  { href: "/metricas-professores", label: "Métricas dos professores", categoria: "visao" },
  { href: "/alunos", label: "Alunos", categoria: "pessoas" },
  { href: "/responsaveis", label: "Responsáveis", categoria: "pessoas" },
  { href: "/professores", label: "Professores", categoria: "pessoas" },
  { href: "/matriculas", label: "Matrículas", categoria: "pessoas" },
  { href: "/importar-alunos", label: "Importar alunos", categoria: "pessoas" },
  { href: "/turmas", label: "Turmas", categoria: "ensino" },
  { href: "/modalidades", label: "Modalidades", categoria: "ensino" },
  { href: "/niveis", label: "Níveis", categoria: "ensino" },
  { href: "/chamada", label: "Chamada", categoria: "ensino" },
  { href: "/calendario", label: "Calendário", categoria: "ensino" },
  { href: "/dna-professores", label: "DNA do Professor", categoria: "ensino" },
  { href: "/espetaculos", label: "Espetáculos", categoria: "ensino" },
  { href: "/salas", label: "Salas", categoria: "espaco" },
  { href: "/rodizio-salas", label: "Rodízio de Salas", categoria: "espaco" },
  { href: "/financeiro", label: "Financeiro", categoria: "financeiro" },
  { href: "/financeiro/faturamento-turmas", label: "Faturamento por turma", categoria: "financeiro" },
  { href: "/financeiro/professores", label: "Financeiro dos professores", categoria: "financeiro" },
  { href: "/financeiro/recebimentos", label: "Recebimentos", categoria: "financeiro" },
  { href: "/financeiro/conta", label: "Conta da escola", categoria: "financeiro" },
  { href: "/financeiro/conta-pagamentos", label: "Conta de pagamentos", categoria: "financeiro" },
  { href: "/financeiro/inadimplencia", label: "Inadimplência", categoria: "financeiro" },
  { href: "/financeiro/growth-churn", label: "Growth & Churn", categoria: "financeiro" },
  { href: "/financeiro/entradas-saidas", label: "Entradas & Saídas", categoria: "financeiro" },
  { href: "/configuracoes", label: "Configurações", categoria: "config" },
  { href: "/configuracoes/escola", label: "Minha escola", categoria: "config" },
  { href: "/configuracoes/usuarios", label: "Usuários", categoria: "config" },
  { href: "/configuracoes/comunicacao", label: "Comunicação", categoria: "config" },
  { href: "/configuracoes/permissoes", label: "Permissões", categoria: "config" },
  { href: "/configuracoes/pina-acessos", label: "Acessos ao Pina", categoria: "config" },
] as const;

/**
 * O que cada papel enxerga, de fábrica.
 *
 * É o PADRÃO, não a lei: a escola pode redesenhar isto na tela de Permissões,
 * e o que estiver gravado ganha. Ausência de gravação significa "usa este
 * mapa" — mesmo raciocínio dos textos de e-mail: o padrão vive em código
 * porque assim é impossível de perder.
 *
 * A DIREÇÃO É INTOCÁVEL e não por preguiça de fazer a caixinha. Ela é a única
 * que alcança a tela de Permissões; deixar desmarcar ali significa que um
 * clique errado tranca a escola inteira para fora da própria administração, e
 * o conserto vira SQL no banco. Um poder que só se usa para se destruir não
 * precisa existir.
 */
export const PERMISSOES_PADRAO: Record<UserRole, string[]> = {
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
    /*
     * Inadimplência e cobrança entram para o aux adm por decisão do Carlos:
     * é ele quem persegue quem não pagou e quem emite a cobrança no dia a
     * dia. `/financeiro/conta` cobre as telas de cobrar e de avulsa.
     *
     * As duas dependem do módulo de pagamento ligado — escola sem Asaas não
     * vê nenhuma das duas, mesmo com a permissão marcada aqui.
     */
    "/financeiro/inadimplencia",
    "/financeiro/conta",
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
const exigemModuloFinanceiro = [
  "/financeiro/inadimplencia",
  // A conta da escola mostra saldo e extrato da conta de pagamentos. Sem o
  // módulo, ela não existe — e uma tela de saldo vazia é pior do que ausência.
  "/financeiro/conta",
];

export function exigeModuloFinanceiro(pathname: string): boolean {
  return exigemModuloFinanceiro.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "admin" || value === "equipe" || value === "professor";
}

/**
 * `permissoes` chega resolvido de fora (banco ou padrão). Esta função
 * continua pura: quem sabe consultar o banco é o servidor, e uma função de
 * decisão que faz I/O é impossível de testar e fácil de chamar no lugar
 * errado.
 */
export function canAccessPath(
  role: UserRole,
  pathname: string,
  permissoes: Record<UserRole, string[]> = PERMISSOES_PADRAO,
) {
  if (pathname === "/acesso-nao-autorizado") {
    return true;
  }
  // A direção não passa pelo mapa: acesso total, sempre. Ver PERMISSOES_PADRAO.
  if (role === "admin") return true;

  return (permissoes[role] ?? []).some((prefix) => matchesPrefix(pathname, prefix));
}

export function getNavigationForRole(
  role: UserRole,
  usaModuloFinanceiro = true,
  permissoes: Record<UserRole, string[]> = PERMISSOES_PADRAO,
) {
  return navigationItems.filter(
    (item) =>
      canAccessPath(role, item.href, permissoes) &&
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
