import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatText } from "@/features/students/formatters";
import type { Guardian } from "@/features/guardians/types";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableRow,
  TableHead,
  TableHeader,
} from "@/components/ui/table";

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
      <PageHeader
        title="Responsáveis"
        description="Cadastro, consulta e vínculo de responsáveis com alunos."
        actions={
          <>
            <Link
              href="/responsaveis/novo"
              className={buttonVariants()}
            >
              Novo responsável
            </Link>
          </>
        }
      />

      <form className="mt-6 grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Buscar por nome, telefone ou e-mail
          </span>
          <Input
            name="q"
            defaultValue={search}
            placeholder="Digite nome, telefone ou e-mail"
            className="mt-1 py-2"
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
            className={buttonVariants({ variant: "outline" })}
          >
            Limpar
          </Link>
        </div>
      </form>

      <Table
        containerClassName="mt-6"
        minWidth="720px"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Atualizado em</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {guardians.length > 0 ? (
            guardians.map((guardian) => (
              <TableRow key={guardian.id}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {guardian.full_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatText(guardian.document)}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatText(guardian.phone)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatText(guardian.email)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(guardian.updated_at)}
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={5}>Nenhum responsável encontrado.</TableEmpty>
          )}
        </TableBody>
      </Table>
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
