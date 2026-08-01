import { PageHeader } from "@/components/layout/page-header";
import { getInadimplencia } from "@/features/baas/inadimplencia-queries";
import { FaturaBotao } from "@/features/baas/fatura-modal";

export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function dataBR(iso: string) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

/** Quanto mais antigo o atraso, mais forte o alerta. */
function tomDoAtraso(dias: number) {
  if (dias >= 30) return "bg-rose-100 text-rose-800";
  if (dias >= 15) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default async function InadimplenciaPage() {
  const { devedores, totalEmAtraso, totalAVencer, quantidadeEmDia } =
    await getInadimplencia();

  return (
    <div>
      <PageHeader
        title="Inadimplência"
        description="Quem está com mensalidade vencida. A cobrança pode ser reenviada aqui mesmo."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Indicador
          rotulo="Em atraso"
          valor={brl.format(totalEmAtraso)}
          detalhe={`${devedores.length} ${devedores.length === 1 ? "responsável" : "responsáveis"}`}
          destaque={devedores.length > 0}
        />
        <Indicador
          rotulo="Em dia"
          valor={String(quantidadeEmDia)}
          detalhe="cobranças pagas"
        />
        <Indicador
          rotulo="A vencer"
          valor={brl.format(totalAVencer)}
          detalhe="ainda no prazo"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        {devedores.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-base font-medium text-foreground">
              Ninguém em atraso.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Todas as mensalidades estão pagas ou dentro do prazo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Responsável</th>
                  <th className="px-4 py-3 font-semibold">Aluno(s)</th>
                  <th className="px-4 py-3 font-semibold">Atraso</th>
                  <th className="px-4 py-3 font-semibold">Venceu em</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-4 py-3 font-semibold">Cobrar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devedores.map((d) => (
                  <tr key={d.contratoId} className="align-top hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{d.responsavel}</p>
                      {d.telefone ? (
                        <p className="text-xs text-muted-foreground">{d.telefone}</p>
                      ) : (
                        <p className="text-xs text-amber-700">sem telefone</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.alunos.join(", ") || "—"}
                      {d.turmas.length > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground/80">
                          {d.turmas.length}{" "}
                          {d.turmas.length === 1 ? "turma" : "turmas"}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${tomDoAtraso(d.diasDeAtraso)}`}
                      >
                        {d.diasDeAtraso} {d.diasDeAtraso === 1 ? "dia" : "dias"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {dataBR(d.vencimento)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                      {brl.format(d.valor)}
                    </td>
                    <td className="px-4 py-3">
                      <FaturaBotao contratoId={d.contratoId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-md border bg-white p-4 ${
        destaque ? "border-rose-200" : "border-border"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          destaque ? "text-rose-700" : "text-foreground"
        }`}
      >
        {valor}
      </p>
      <p className="text-xs text-muted-foreground">{detalhe}</p>
    </div>
  );
}
