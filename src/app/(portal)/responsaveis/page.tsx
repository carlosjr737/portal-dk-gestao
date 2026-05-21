import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatText } from "@/features/students/formatters";
import type { Guardian } from "@/features/guardians/types";

type ResponsaveisPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function ResponsaveisPage({
  searchParams,
}: ResponsaveisPageProps) {
  const params = await searchParams;
  const search = params?.q?.trim() ?? "";
  const guardians = await getGuardians(search);

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Responsáveis"
          description="Cadastro, consulta e vínculo de responsáveis com alunos."
        />
        <Link
          href="/responsaveis/novo"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Novo responsável
        </Link>
      </div>

      <form className="mt-6 grid gap-3 rounded-md border border-border bg-white p-4 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Buscar por nome, telefone ou e-mail
          </span>
          <input
            name="q"
            defaultValue={search}
            placeholder="Digite nome, telefone ou e-mail"
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
          />
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90"
          >
            Buscar
          </button>
          <Link
            href="/responsaveis"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Limpar
          </Link>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Telefone</th>
                <th className="px-4 py-3 font-semibold">E-mail</th>
                <th className="px-4 py-3 font-semibold">Atualizado em</th>
                <th className="px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {guardians.length > 0 ? (
                guardians.map((guardian) => (
                  <tr key={guardian.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {guardian.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatText(guardian.document)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatText(guardian.phone)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatText(guardian.email)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(guardian.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/responsaveis/${guardian.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/responsaveis/${guardian.id}/editar`}
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum responsável encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function getGuardians(search: string): Promise<Guardian[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("guardians")
      .select("id, full_name, document, phone, email, notes, created_at, updated_at")
      .order("full_name", { ascending: true });

    if (search) {
      const normalizedSearch = search.replaceAll(",", " ");
      query = query.or(
        `full_name.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Guardians list load error:", error.message);
      return [];
    }

    return (data ?? []) as Guardian[];
  } catch (error) {
    console.error(
      "Guardians list load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
