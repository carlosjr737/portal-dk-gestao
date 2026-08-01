import { createAdminClient } from "@/lib/supabase/admin";
import {
  AssinaturaForm,
  type PlanoOption,
} from "@/features/plataforma/assinatura-form";

export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ASSINATURA_LABEL: Record<string, { texto: string; classe: string }> = {
  pendente: { texto: "Aguardando pagamento", classe: "bg-amber-100 text-amber-800" },
  ativa: { texto: "Ativa", classe: "bg-emerald-100 text-emerald-800" },
  atrasada: { texto: "Em atraso", classe: "bg-rose-100 text-rose-800" },
  cancelada: { texto: "Cancelada", classe: "bg-slate-200 text-slate-600" },
};

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

  const [{ data: assinaturas }, { data: planosRows }] = await Promise.all([
    admin
      .from("plataforma_assinatura")
      .select("escola_id, status, valor, proximo_vencimento"),
    admin
      .from("plataforma_plano")
      .select("id, nome, periodicidade, valor")
      .eq("ativo", true)
      .order("valor"),
  ]);

  const assinaturaPorEscola = new Map(
    (assinaturas ?? []).map((a) => [a.escola_id as string, a]),
  );
  const planos: PlanoOption[] = (planosRows ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    periodicidade: p.periodicidade as string,
    valor: Number(p.valor),
  }));

  const receitaMensal = (assinaturas ?? [])
    .filter((a) => a.status === "ativa")
    .reduce((s, a) => s + Number(a.valor), 0);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Escolas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Clientes da plataforma. A assinatura é o que libera o acesso ao sistema.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">
            {lista.length} {lista.length === 1 ? "escola" : "escolas"}
          </p>
          {receitaMensal > 0 ? (
            <p className="text-xs text-slate-500">
              Assinaturas ativas: <strong>{brl.format(receitaMensal)}</strong>
            </p>
          ) : null}
        </div>
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
                      {(() => {
                        const a = assinaturaPorEscola.get(e.id as string);
                        if (!a) {
                          return (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              Sem assinatura
                            </span>
                          );
                        }
                        const label =
                          ASSINATURA_LABEL[a.status as string] ??
                          ASSINATURA_LABEL.pendente;
                        return (
                          <div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${label.classe}`}
                            >
                              {label.texto}
                            </span>
                            <p className="mt-1 text-xs text-slate-500">
                              {brl.format(Number(a.valor))}
                              {a.proximo_vencimento
                                ? ` · vence ${(a.proximo_vencimento as string)
                                    .split("-")
                                    .reverse()
                                    .join("/")}`
                                : ""}
                            </p>
                          </div>
                        );
                      })()}
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

      {lista.filter((e) => !assinaturaPorEscola.has(e.id as string)).length > 0 ? (
        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Nova assinatura</h2>
          <p className="mt-1 text-sm text-slate-500">
            Cobrada na conta da plataforma. É separada da conta de pagamentos da
            escola, usada para receber dos alunos dela.
          </p>
          <div className="mt-4 space-y-5">
            {lista
              .filter((e) => !assinaturaPorEscola.has(e.id as string))
              .map((e) => (
                <AssinaturaForm
                  key={e.id as string}
                  escolaId={e.id as string}
                  escolaNome={e.nome as string}
                  planos={planos}
                />
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
