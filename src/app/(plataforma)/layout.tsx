import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformOwner } from "@/features/plataforma/auth";

export const dynamic = "force-dynamic";

/**
 * Área da PLATAFORMA — separada do portal da escola de propósito.
 *
 * Aqui só existe o que é da operação do SaaS (escolas, assinaturas). Nada de
 * aluno, turma ou chamada: são assuntos e públicos diferentes, e misturá-los
 * na mesma navegação vira ruído.
 */
export default async function PlataformaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isPlatformOwner())) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/plataforma" className="text-sm font-semibold text-white">
              Plataforma
              <span className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-slate-300">
                operação
              </span>
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/plataforma" className="text-slate-300 hover:text-white">
                Escolas
              </Link>
              <Link
                href="/plataforma/kpis"
                className="text-slate-300 hover:text-white"
              >
                Indicadores
              </Link>
            </nav>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-slate-400 transition hover:text-white"
          >
            ← Voltar ao portal
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
