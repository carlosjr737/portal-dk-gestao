export type UserRole = "admin" | "equipe" | "professor";

export type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
};

export const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  equipe: "Equipe",
  professor: "Professor",
};

export const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/metricas-escola", label: "Métricas da escola" },
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
  { href: "/importar-alunos", label: "Importar alunos" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/financeiro/inadimplencia", label: "Inadimplência" },
  { href: "/financeiro/growth-churn", label: "Growth & Churn" },
  { href: "/financeiro/vinculos-conta-azul", label: "Vínculos Conta Azul" },
  { href: "/financeiro/configuracoes", label: "Configurações financeiras" },
  { href: "/configuracoes", label: "Configurações" },
  { href: "/configuracoes/usuarios", label: "Usuários" },
] as const;

const roleRoutePrefixes: Record<UserRole, string[]> = {
  admin: ["/"],
  equipe: [
    "/dashboard",
    "/metricas-escola",
    "/alunos",
    "/responsaveis",
    "/turmas",
    "/salas",
    "/rodizio-salas",
    "/matriculas",
    "/chamada",
    "/calendario",
    "/dna-professores",
    "/importar-alunos",
  ],
  professor: ["/dashboard", "/chamada", "/calendario", "/turmas"],
};

const roleNavigationPrefixes: Record<UserRole, string[]> = {
  admin: ["/"],
  equipe: [
    "/dashboard",
    "/metricas-escola",
    "/alunos",
    "/responsaveis",
    "/turmas",
    "/salas",
    "/rodizio-salas",
    "/matriculas",
    "/chamada",
    "/calendario",
    "/dna-professores",
    "/importar-alunos",
  ],
  professor: ["/chamada", "/calendario", "/turmas", "/rodizio-salas"],
};

export function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "admin" || value === "equipe" || value === "professor";
}

export function canAccessPath(role: UserRole, pathname: string) {
  if (pathname === "/acesso-nao-autorizado") {
    return true;
  }

  return roleRoutePrefixes[role].some((prefix) => matchesPrefix(pathname, prefix));
}

export function getNavigationForRole(role: UserRole) {
  return navigationItems.filter((item) =>
    roleNavigationPrefixes[role].some((prefix) =>
      matchesPrefix(item.href, prefix),
    ),
  );
}

function matchesPrefix(pathname: string, prefix: string) {
  return prefix === "/" || pathname === prefix || pathname.startsWith(`${prefix}/`);
}
