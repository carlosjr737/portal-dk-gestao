import { createAdminClient } from "@/lib/supabase/admin";
import { Alert } from "@/components/ui/alert";
import { METRICAS } from "@/features/metricas/captura";

/**
 * A evolução mês a mês do que já foi fotografado.
 *
 * MOSTRA SÓ O QUE EXISTE. Nada de preencher mês sem captura com zero: zero é
 * um número, e "nenhum aluno em junho" é uma afirmação diferente de "não
 * fotografamos junho". A tabela vazia com o aviso é honesta; a linha caindo
 * até o chão seria mentira.
 */

const MES_CURTO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function rotuloMes(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${MES_CURTO[Number(mes) - 1]}/${ano.slice(2)}`;
}

function formatar(valor: number, formato: string): string {
  if (formato === "dinheiro")
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (formato === "porcentagem") return `${valor.toLocaleString("pt-BR")}%`;
  return valor.toLocaleString("pt-BR");
}

/** Variação contra o mês anterior. Null quando não há com o que comparar. */
function variacao(atual: number, anterior: number | undefined): number | null {
  if (anterior === undefined || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export async function EvolucaoMensal({ escolaId }: { escolaId: string | null }) {
  if (!escolaId) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("metrica_mensal")
    .select("competencia, metrica, valor, origem")
    .eq("dimensao", "escola")
    .eq("escola_id", escolaId)
    .order("competencia", { ascending: true });

  if (error) {
    return (
      <Alert tone="danger">
        Não foi possível ler o histórico: {error.message}
      </Alert>
    );
  }

  const linhas = (data ?? []) as Array<{
    competencia: string;
    metrica: string;
    valor: number;
    origem: string;
  }>;

  if (linhas.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Evolução mensal</h2>
        <Alert tone="info">
          Ainda não há nenhum mês fotografado. A primeira foto é tirada no dia 1º
          do mês que vem, e a partir dali cada mês fica guardado.
        </Alert>
      </section>
    );
  }

  const competencias = [...new Set(linhas.map((l) => l.competencia))];
  const porChave = new Map<string, Map<string, number>>();
  const reconstruidas = new Set<string>();

  for (const l of linhas) {
    if (!porChave.has(l.metrica)) porChave.set(l.metrica, new Map());
    porChave.get(l.metrica)!.set(l.competencia, Number(l.valor));
    if (l.origem === "reconstruido") reconstruidas.add(l.competencia);
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Evolução mensal</h2>
        <p className="text-sm text-muted-foreground">
          Cada mês é fotografado no dia 1º. O que está aqui é o que era verdade
          naquele momento — não muda depois.
        </p>
      </div>

      {reconstruidas.size > 0 ? (
        <Alert tone="warning">
          {reconstruidas.size === 1 ? "Um mês foi reconstruído" : `${reconstruidas.size} meses foram reconstruídos`}{" "}
          depois do fato ({[...reconstruidas].map(rotuloMes).join(", ")}). As
          contagens são confiáveis; os valores em dinheiro usam a mensalidade de
          hoje, então servem de referência, não de registro.
        </Alert>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="p-3 text-left font-medium text-foreground">Métrica</th>
              {competencias.map((c) => (
                <th key={c} className="p-3 text-right font-medium text-foreground">
                  {rotuloMes(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICAS.map((m) => {
              const valores = porChave.get(m.chave);
              if (!valores) return null;
              return (
                <tr key={m.chave} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <span className="font-medium text-foreground">{m.rotulo}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {m.explicacao}
                    </span>
                  </td>
                  {competencias.map((c, i) => {
                    const v = valores.get(c);
                    if (v === undefined) {
                      return (
                        <td key={c} className="p-3 text-right text-muted-foreground">
                          —
                        </td>
                      );
                    }
                    const delta = variacao(v, valores.get(competencias[i - 1] ?? ""));
                    return (
                      <td key={c} className="p-3 text-right tabular-nums">
                        <span className="text-foreground">{formatar(v, m.formato)}</span>
                        {delta !== null && Math.abs(delta) >= 0.1 ? (
                          <span
                            className={`mt-0.5 block text-xs ${
                              delta > 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
