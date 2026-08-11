"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BarChart3,
  BookUser,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Drama,
  FileSpreadsheet,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LineChart,
  Receipt,
  Repeat,
  Settings,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  getNavigationForRole,
  type UserRole,
} from "@/features/auth/permissions";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  /**
   * As permissões da escola, resolvidas no servidor. Vêm por prop em vez de
   * serem lidas aqui porque este componente é de cliente — e permissão que o
   * navegador busca é permissão que o navegador pode mentir.
   */
  permissoes?: Record<UserRole, string[]>;
  usaModuloFinanceiro?: boolean;
  /** Nome da escola do usuário logado. O produto serve várias. */
  escolaNome?: string | null;
};

/**
 * Ícone por rota.
 *
 * Fica aqui e não em `permissions.ts` de propósito: aquele arquivo decide
 * QUEM vê o quê, e não deve carregar um componente de UI junto. Rota sem
 * entrada aqui cai num ícone neutro em vez de quebrar.
 */
const iconByHref: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/metricas-escola": BarChart3,
  "/metricas-publico": Sparkles,
  "/metricas-professores": UserRound,
  "/alunos": Users,
  "/responsaveis": BookUser,
  "/matriculas": ClipboardList,
  "/importar-alunos": FileSpreadsheet,
  "/turmas": GraduationCap,
  "/salas": LayoutDashboard,
  "/rodizio-salas": Repeat,
  "/chamada": CalendarCheck,
  "/professores": UserRound,
  "/modalidades": Drama,
  "/niveis": LineChart,
  "/calendario": CalendarDays,
  "/dna-professores": Sparkles,
  "/espetaculos": Drama,
  "/financeiro": Wallet,
  "/financeiro/faturamento-turmas": Receipt,
  "/financeiro/recebimentos": Banknote,
  "/financeiro/conta": Landmark,
  "/financeiro/conta-pagamentos": Landmark,
  "/financeiro/professores": Wallet,
  "/financeiro/inadimplencia": Receipt,
  "/financeiro/growth-churn": TrendingUp,
  "/financeiro/entradas-saidas": Wallet,
  "/configuracoes": Settings,
  "/configuracoes/escola": Settings,
  "/configuracoes/usuarios": Users,
  "/configuracoes/pina-acessos": Settings,
};

const navigationGroups = [
  {
    title: "Principal",
    accordion: false,
    items: [
      "/dashboard",
      "/metricas-escola",
      "/metricas-publico",
      "/metricas-professores",
    ],
  },
  {
    title: "Gestão acadêmica",
    accordion: true,
    items: ["/alunos", "/responsaveis", "/matriculas", "/importar-alunos"],
  },
  {
    title: "Turmas e aulas",
    accordion: true,
    items: [
      "/turmas",
      "/salas",
      "/rodizio-salas",
      "/chamada",
      "/professores",
      "/modalidades",
      "/niveis",
    ],
  },
  {
    title: "Operação",
    accordion: true,
    items: ["/calendario", "/dna-professores", "/espetaculos"],
  },
  {
    title: "Financeiro",
    accordion: true,
    items: [
      "/financeiro",
      "/financeiro/faturamento-turmas",
      "/financeiro/professores",
      "/financeiro/recebimentos",
      "/financeiro/conta",
      "/financeiro/conta-pagamentos",
      "/financeiro/inadimplencia",
      "/financeiro/growth-churn",
      "/financeiro/entradas-saidas",
    ],
  },
  {
    title: "Sistema",
    accordion: true,
    items: [
      "/configuracoes/escola",
      "/configuracoes/usuarios",
      "/configuracoes/pina-acessos",
      "/configuracoes",
    ],
  },
] as const;

export function Sidebar({
  isOpen,
  onClose,
  role,
  permissoes,
  usaModuloFinanceiro = true,
  escolaNome,
}: SidebarProps) {
  const pathname = usePathname();
  const navigation = getNavigationForRole(role, usaModuloFinanceiro, permissoes);
  const navigationByHref = useMemo(
    () => new Map(navigation.map((item) => [item.href, item])),
    [navigation],
  );
  const visibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          visibleItems: group.items
            .map((href) => navigationByHref.get(href))
            .filter((item): item is NonNullable<typeof item> => Boolean(item)),
        }))
        .filter((group) => group.visibleItems.length > 0),
    [navigationByHref],
  );
  const activeHref = getActiveHref(
    pathname,
    visibleGroups.flatMap((group) => group.visibleItems.map((item) => item.href)),
  );
  const activeGroupTitle = visibleGroups.find((group) =>
    group.visibleItems.some((item) => item.href === activeHref),
  )?.title;

  /*
   * Conjunto, não um grupo só. Antes abrir "Financeiro" fechava "Turmas e
   * aulas", e quem trabalha entre os dois pagava dois cliques por ida e
   * volta. O grupo ativo entra aberto e o resto continua como o usuário
   * deixou.
   */
  const [openGroups, setOpenGroups] = useState<string[]>(
    activeGroupTitle ? [activeGroupTitle] : [],
  );

  useEffect(() => {
    if (!activeGroupTitle) return;
    setOpenGroups((current) =>
      current.includes(activeGroupTitle) ? current : [...current, activeGroupTitle],
    );
  }, [activeGroupTitle]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-inverse text-white/70 transition-transform duration-200 md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">
              {initial(escolaNome)}
            </span>
            {/*
              A linha grande é a ESCOLA: quem está aqui trabalha numa escola,
              não numa plataforma. O nome do produto aparece uma vez só, e o
              cabeçalho não repete.
            */}
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-white">
                {escolaNome ?? PLATFORM_NAME}
              </span>
              <span className="block truncate text-[11px] text-white/55">
                {escolaNome ? PLATFORM_NAME : PLATFORM_TAGLINE}
              </span>
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="rounded-md px-2 py-1 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white md:hidden"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
          {visibleGroups.map((group) => {
            if (!group.accordion) {
              return (
                <div key={group.title} className="space-y-0.5">
                  {group.visibleItems.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={activeHref === item.href}
                      onClose={onClose}
                    />
                  ))}
                </div>
              );
            }

            const isOpenGroup = openGroups.includes(group.title);

            return (
              <div key={group.title} className="space-y-0.5">
                <button
                  type="button"
                  aria-expanded={isOpenGroup}
                  onClick={() =>
                    setOpenGroups((current) =>
                      current.includes(group.title)
                        ? current.filter((title) => title !== group.title)
                        : [...current, group.title],
                    )
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/55 transition hover:text-white"
                >
                  <span>{group.title}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      isOpenGroup ? "rotate-0" : "-rotate-90",
                    )}
                    aria-hidden="true"
                  />
                </button>

                {isOpenGroup ? (
                  <div className="space-y-0.5">
                    {group.visibleItems.map((item) => (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        active={activeHref === item.href}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  active,
  onClose,
}: {
  href: string;
  label: string;
  active: boolean;
  onClose: () => void;
}) {
  const Icon = iconByHref[href] ?? LayoutDashboard;

  return (
    <Link
      href={href}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition",
        active
          ? "bg-primary text-primary-foreground"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** Inicial da escola para a marca d'água do topo. Sem escola, sem letra. */
function initial(escolaNome?: string | null) {
  const nome = escolaNome?.trim();
  if (!nome) return "•";
  return nome[0]?.toUpperCase() ?? "•";
}

function getActiveHref(pathname: string, hrefs: string[]) {
  const exactMatch = hrefs.find((href) => pathname === href);

  if (exactMatch) {
    return exactMatch;
  }

  return hrefs
    .filter((href) => pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
