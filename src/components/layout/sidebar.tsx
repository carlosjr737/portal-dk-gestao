"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/alunos", label: "Alunos" },
  { href: "/responsaveis", label: "Responsáveis" },
  { href: "/turmas", label: "Turmas" },
  { href: "/professores", label: "Professores" },
  { href: "/modalidades", label: "Modalidades" },
  { href: "/niveis", label: "Níveis" },
  { href: "/matriculas", label: "Matrículas" },
  { href: "/importar-alunos", label: "Importar alunos" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/configuracoes", label: "Configurações" },
];

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

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

        <nav className="flex flex-1 flex-col gap-1 px-3 py-5">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "rounded-md px-3 py-2.5 text-sm font-medium transition",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
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
