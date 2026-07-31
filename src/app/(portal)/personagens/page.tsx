import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  PersonagemCreate,
  PersonagemRow,
  type AlunoOption,
  type PersonagemItem,
} from "@/features/personagem/personagem-ui";

export const dynamic = "force-dynamic";

export default async function PersonagensPage() {
  const supabase = await createClient();

  const [{ data: personagens }, { data: alunos }] = await Promise.all([
    supabase
      .from("personagem")
      .select("id, nome, cor, aluno_id")
      .order("nome", { ascending: true }),
    supabase
      .from("students")
      .select("id, full_name")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
  ]);

  const alunoOptions: AlunoOption[] = (alunos ?? []).map((a) => ({
    id: a.id as string,
    nome: (a.full_name as string | null) ?? "",
  }));
  const lista = (personagens ?? []) as PersonagemItem[];

  return (
    <div>
      <PageHeader
        title="Personagens"
        description="Pool de personagens da escola (Morticia, Wandinha, Gomez…). Reutilizáveis em qualquer espetáculo — o Pina consome esta lista."
      />

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">Novo personagem</h2>
        <div className="mt-3">
          <PersonagemCreate alunos={alunoOptions} />
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Personagens cadastrados
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {lista.length}
            </span>
          </h2>
        </div>
        {lista.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2 font-medium" colSpan={4}>
                  Personagem · cor · aluno vinculado
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map((p) => (
                <PersonagemRow key={p.id} personagem={p} alunos={alunoOptions} />
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhum personagem cadastrado ainda.
          </p>
        )}
        {lista.length > 0 ? (
          <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
            {lista.filter((p) => p.aluno_id).length} vinculados a um aluno ·{" "}
            {lista.filter((p) => !p.aluno_id).length} livres
          </p>
        ) : null}
      </section>
    </div>
  );
}
