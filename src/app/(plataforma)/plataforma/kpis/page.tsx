import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getKpisPlataforma } from "@/features/plataforma/kpis-queries";
import {
  getHistoricoFaturamento,
  variacaoUltimoMes,
} from "@/features/plataforma/kpis-historico";

export const dynamic = "force-dynamic";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const inteiro = new Intl.NumberFormat("pt-BR");

/** Valor lido, ou um travessão — nunca R$ 0 para "não consegui ler". */
function valor(v: number | null) {
  return v === null ? "—" : dinheiro.format(v);
}

export default async function KpisPage() {
  const [{ escolas, totais, mrrPlataforma }, historico] = await Promise.all([
    getKpisPlataforma(),
    getHistoricoFaturamento(),
  ]);

  const historicoPor = new Map(
    historico.porEscola.map((h) => [h.escolaId, h.pontos]),
  );
  const variacaoTotal = variacaoUltimoMes(historico.total);
  const janela = historico.total.length;

  return (
    <div>
      <PageHeader
        title="Indicadores"
        description="O que a plataforma recebe, e o que as escolas clientes estão movimentando."
        actions={
          <Link
            href="/plataforma"
            className={buttonVariants({ variant: "outline" })}
          >
            Escolas
          </Link>
        }
      />

      {/*
        Dois blocos separados de propósito. O de cima é o SEU negócio; o de
        baixo é o das suas clientes. Misturar faria alguém somar receita de
        assinatura com faturamento de escola, que são dinheiros de donos
        diferentes.
      */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Sua plataforma</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Indicador
            rotulo="Receita recorrente"
            valor={dinheiro.format(mrrPlataforma)}
            apoio="soma das assinaturas ativas"
          />
          <Indicador
            rotulo="Escolas"
            valor={String(totais.escolas)}
            apoio={`${totais.escolasComPagamento} com pagamentos ativos`}
          />
          <Indicador
            rotulo="Alunos na base"
            valor={inteiro.format(totais.alunosAtivos)}
            apoio="somando todas as escolas"
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            Movimentação das escolas
          </h2>
          <p className="text-sm text-muted-foreground">
            Lido do Asaas com a chave de cada escola — o dinheiro não passa
            pela plataforma, só a consulta.
          </p>
        </div>

        {totais.escolasSemLeitura > 0 ? (
          <Alert tone="info" className="mt-3">
            {totais.escolasSemLeitura === 1
              ? "1 escola não entra nos totais"
              : `${totais.escolasSemLeitura} escolas não entram nos totais`}{" "}
            — o motivo aparece na linha de cada uma.
          </Alert>
        ) : null}

        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          <Indicador
            rotulo="Recebido no mês"
            valor={dinheiro.format(totais.recebidoNoMes)}
            apoio="líquido, já sem a taxa"
            variacao={variacaoTotal}
            grafico={
              janela > 1 ? (
                <Sparkline
                  values={historico.total.map((p) => p.recebido)}
                  label={`Recebido nos últimos ${janela} meses`}
                  className="mt-3 h-9 w-full"
                  color="hsl(var(--success))"
                />
              ) : null
            }
            legenda={janela > 1 ? `últimos ${janela} meses` : undefined}
          />
          <Indicador
            rotulo="A receber no mês"
            valor={dinheiro.format(totais.aReceberNoMes)}
            apoio="ainda dentro do prazo"
          />
          <Indicador
            rotulo="Vencido em aberto"
            valor={dinheiro.format(totais.vencidoEmAberto)}
            apoio="acumulado, não só deste mês"
            alarme={totais.vencidoEmAberto > 0}
          />
        </div>

        {historico.naoBuscado ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Sem histórico: {historico.naoBuscado}
          </p>
        ) : null}
      </section>

      <Table containerClassName="mt-6" minWidth="960px">
        <TableHeader>
          <TableRow>
            <TableHead>Escola</TableHead>
            <TableHead className="text-right tabular-nums">Alunos</TableHead>
            <TableHead className="text-right tabular-nums">Matrículas</TableHead>
            <TableHead>Faturamento</TableHead>
            <TableHead className="text-right tabular-nums">No mês</TableHead>
            <TableHead className="text-right tabular-nums">A receber</TableHead>
            <TableHead className="text-right tabular-nums">Vencido</TableHead>
            <TableHead className="text-right tabular-nums">Saldo</TableHead>
            <TableHead>Assinatura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {escolas.length === 0 ? (
            <TableEmpty colSpan={9}>Nenhuma escola cadastrada ainda.</TableEmpty>
          ) : null}
          {escolas.map((e) => {
            const pontos = historicoPor.get(e.escolaId) ?? [];
            const variacao = variacaoUltimoMes(pontos);

            return (
              <TableRow key={e.escolaId}>
                <TableCell className="font-medium text-foreground">
                  {e.nome}
                  {e.motivoSemDados ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {e.motivoSemDados}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {e.alunosAtivos}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {e.matriculasAtivas}
                </TableCell>
                <TableCell>
                  {pontos.length > 1 ? (
                    <Sparkline
                      values={pontos.map((p) => p.recebido)}
                      label={`Faturamento de ${e.nome} nos últimos ${pontos.length} meses`}
                      className="h-7 w-28"
                      color="hsl(var(--success))"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <div>{valor(e.recebidoNoMes)}</div>
                  {variacao !== null ? (
                    <Variacao valor={variacao} />
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {valor(e.aReceberNoMes)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {e.vencidoEmAberto ? (
                    <span className="text-danger-text">
                      {valor(e.vencidoEmAberto)}
                    </span>
                  ) : (
                    valor(e.vencidoEmAberto)
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {valor(e.saldo)}
                </TableCell>
                <TableCell>
                  {e.assinaturaStatus === "ativa" ? (
                    <Badge tone="success">Ativa</Badge>
                  ) : e.assinaturaStatus ? (
                    <Badge tone="warning">{e.assinaturaStatus}</Badge>
                  ) : (
                    <Badge tone="neutral">Sem assinatura</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="mt-3 text-xs text-muted-foreground">
        &ldquo;Recebido&rdquo; soma o pago pelo Asaas, o confirmado ainda não
        creditado e o que a escola registrou como recebido em dinheiro. Valores
        líquidos, já sem a taxa.
      </p>
    </div>
  );
}

function Variacao({ valor }: { valor: number }) {
  const subiu = valor >= 0;
  return (
    <div
      className={`text-xs font-medium ${subiu ? "text-success-text" : "text-danger-text"}`}
    >
      {subiu ? "▲" : "▼"} {Math.abs(valor).toFixed(0)}%
      <span className="ml-1 font-normal text-muted-foreground">
        vs. mês anterior
      </span>
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  apoio,
  alarme,
  variacao,
  grafico,
  legenda,
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  alarme?: boolean;
  variacao?: number | null;
  grafico?: React.ReactNode;
  legenda?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p
        className={`mt-2 text-[28px] font-bold leading-[34px] tabular-nums ${
          alarme ? "text-danger-text" : "text-foreground"
        }`}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{apoio}</p>
      {variacao !== null && variacao !== undefined ? (
        <div className="mt-2">
          <Variacao valor={variacao} />
        </div>
      ) : null}
      {grafico}
      {legenda ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{legenda}</p>
      ) : null}
    </Card>
  );
}
