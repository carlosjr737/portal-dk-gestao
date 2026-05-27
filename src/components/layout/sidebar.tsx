"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getNavigationForRole,
  type UserRole,
} from "@/features/auth/permissions";
import { cn } from "@/lib/utils";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
};

const navigationGroups = [
  {
    title: "Principal",
    accordion: false,
    items: ["/dashboard"],
  },
  {
    title: "Gestão acadêmica",
    accordion: true,
    items: ["/alunos", "/responsaveis", "/matriculas", "/importar-alunos"],
  },
  {
    title: "Turmas e aulas",
    accordion: true,
    items: ["/turmas", "/chamada", "/professores", "/modalidades", "/niveis"],
  },
  {
    title: "Operação",
    accordion: true,
    items: ["/calendario"],
  },
  {
    title: "Financeiro",
    accordion: true,
    items: [
      "/financeiro",
      "/financeiro/inadimplencia",
      "/financeiro/growth-churn",
      "/financeiro/vinculos-conta-azul",
      "/financeiro/configuracoes",
    ],
  },
  {
    title: "Sistema",
    accordion: true,
    items: ["/configuracoes/usuarios", "/configuracoes"],
  },
] as const;

export function Sidebar({ isOpen, onClose, role }: SidebarProps) {
  const pathname = usePathname();
  const navigation = getNavigationForRole(role);
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
  const [openGroup, setOpenGroup] = useState<string | null>(
    activeGroupTitle ?? null,
  );

  useEffect(() => {
    setOpenGroup(activeGroupTitle ?? null);
  }, [activeGroupTitle]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-white shadow-xl transition-transform duration-200 md:translate-x-0 md:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div>
            <p className="text-base font-semibold text-foreground">
              Portal DK Gestão
            </p>
            <p className="text-xs text-muted-foreground">DK Studio</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground md:hidden"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => {
            if (!group.accordion) {
              return group.visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    activeHref === item.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ));
            }

            const isOpenGroup = openGroup === group.title;
            const hasActiveItem = group.title === activeGroupTitle;

            return (
              <div key={group.title} className="mt-1">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroup((current) =>
                      current === group.title ? null : group.title,
                    )
                  }
                  className={cn(
                    "flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-[13px] font-semibold uppercase tracking-wide transition",
                    hasActiveItem || isOpenGroup
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span>{group.title}</span>
                  <span className="text-xs" aria-hidden="true">
                    {isOpenGroup ? "▾" : "▸"}
                  </span>
                </button>

                {isOpenGroup ? (
                  <div className="mt-1 flex flex-col gap-0.5 pl-3">
                    {group.visibleItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm font-medium transition",
                          activeHref === item.href
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Operação interna
          </p>
          <p className="mt-1 text-sm text-foreground">Gestão artística e administrativa</p>
        </div>
      </div>
    </aside>
  );
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
