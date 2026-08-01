import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const KYC_LABEL: Record<string, { texto: string; classe: string }> = {
  pendente: { texto: "Sem conta", classe: "bg-slate-100 text-slate-600" },
  analise: { texto: "Em análise", classe: "bg-amber-100 text-amber-800" },
  aprovada: { texto: "Aprovada", classe: "bg-emerald-100 text-emerald-800" },
  recusada: { texto: "Recusada", classe: "bg-rose-100 text-rose-800" },
};

export default async function PlataformaEscolasPage() {
  // O layout já barrou quem não é operador; aqui o admin client é usado para
  // enxergar TODAS as escolas, que é justamente o que a RLS impede por padrão.
  const admin = createAdminClient();
  const { data: escolas } = await admin
    .from("school")
    .select("id, nome, razao_social, cnpj, cidade, uf, status, kyc_status, created_at")
    .order("created_at", { ascending: true });

  const lista = escolas ?? [];

  // Contagem de alunos ativos por escola, para dar noção de porte.
  const { data: alunos } = await admin
    .from("students")
    .select("escola_id")
    .eq("status", "active");
  const alunosPorEscola = new Map<string, number>();
  for (const a of alunos ?? []) {
    const k = a.escola_id as string;
    alunosPorEscola.set(k, (alunosPorEscola.get(k) ?? 0) + 1);
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Escolas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Clientes da plataforma. A assinatura é o que libera o acesso ao sistema.
          </p>
        </div>
        <span className="text-sm text-slate-500">
          {lista.length} {lista.length === 1 ? "escola" : "escolas"}
        </span>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Escola</th>
              <th className="px-4 py-3 font-semibold">CNPJ</th>
              <th className="px-4 py-3 font-semibold">Cidade</th>
              <th className="px-4 py-3 font-semibold text-right">Alunos</th>
              <th className="px-4 py-3 font-semibold">Assinatura</th>
              <th className="px-4 py-3 font-semibold">Conta de pagamentos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.length > 0 ? (
              lista.map((e) => {
                const kyc =
                  KYC_LABEL[(e.kyc_status as string) ?? "pendente"] ??
                  KYC_LABEL.pendente;
                return (
                  <tr key={e.id as string} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{e.nome as string}</p>
                      {e.razao_social && e.razao_social !== e.nome ? (
                        <p className="text-xs text-slate-500">
                          {e.razao_social as string}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {(e.cnpj as string | null) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {[e.cidade, e.uf].filter(Boolean).join("/") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {alunosPorEscola.get(e.id as string) ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        Não configurada
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${kyc.classe}`}
                      >
                        {kyc.texto}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Nenhuma escola cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        A coluna <strong>Assinatura</strong> ainda não tem cobrança ligada — é a
        próxima etapa (planos e cobrança recorrente na conta da plataforma).
      </p>
    </div>
  );
}
