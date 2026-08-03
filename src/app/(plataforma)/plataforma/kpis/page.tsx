import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
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
import {
  agregarChurn,
  churnDoUltimoMesFechado,
  getChurnMensal,
  getEvolucaoDaBase,
  rotuloDoMes,
  INICIO_DA_SERIE_DE_CHURN,
  variacaoDaBase,
  variacaoMesAMes,
} from "@/features/plataforma/kpis-base";

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
  const [{ escolas, totais, mrrPlataforma }, historico, evolucao] =
    await Promise.all([
      getKpisPlataforma(),
      getHistoricoFaturamento(),
      getEvolucaoDaBase(),
    ]);

  const basePor = new Map(evolucao.map((e) => [e.escolaId, e.pontos]));

  const churnTotal = agregarChurn(await getChurnMensal(evolucao));
  const churn = churnDoUltimoMesFechado(churnTotal);

  // Série somada de todas as escolas, mês a mês.
  const baseTotal = (evolucao[0]?.pontos ?? []).map((_, i) => ({
    mes: evolucao[0].pontos[i].mes,
    rotulo: evolucao[0].pontos[i].rotulo,
    matriculas: evolucao.reduce((s, e) => s + (e.pontos[i]?.matriculas ?? 0), 0),
    alunos: evolucao.reduce((s, e) => s + (e.pontos[i]?.alunos ?? 0), 0),
  }));
  const variacaoPeriodo = variacaoDaBase(baseTotal);
  const variacaoUltimo = variacaoMesAMes(baseTotal);

  /*
   * O que existe de cobrança emitida no mês, nas escolas que deu para ler.
   * Serve de denominador honesto: recebido sobre emitido é taxa de pagamento,
   * recebido sobre contratado seria taxa de pagamento MISTURADA com o quanto
   * da migração já foi feita — dois problemas diferentes num número só.
   */
  const cobradoNoMes = totais.recebidoNoMes + totais.aReceberNoMes;

  /*
   * Uma casa decimal quando passa de 99%: arredondar 99,7% para "100%" fazia
   * o aviso dizer que NADA foi cobrado, ao lado de um card mostrando R$ 904
   * recebidos. Duas afirmações que se contradizem na mesma tela custam mais
   * do que a precisão que o arredondamento economiza.
   */
  const pctSemCobranca =
    totais.contratadoDasComLeitura > 0
      ? 100 - (cobradoNoMes / totais.contratadoDasComLeitura) * 100
      : 0;
  const pctSemCobrancaTexto = pctSemCobranca
    .toFixed(pctSemCobranca > 99 && pctSemCobranca < 100 ? 1 : 0)
    .replace(".", ",");

  const historicoPor = new Map(
    historico.porEscola.map((h) => [h.escolaId, h.pontos]),
  );

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
        Três blocos, separados de propósito e nesta ordem: o SEU negócio, a
        base das clientes, e o dinheiro delas.

        Misturar o primeiro com o terceiro faria alguém somar receita de
        assinatura com faturamento de escola, que são dinheiros de donos
        diferentes. E o do meio vem antes do financeiro porque aluno que sai
        aparece na base semanas antes de aparecer na receita.
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
        <h2 className="text-lg font-semibold text-foreground">
          Base e movimento
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Do nosso banco, não do Asaas. Entradas e saídas usam a mesma fonte da
          tela de Growth &amp; Churn do portal.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Indicador
            rotulo="Matrículas ativas"
            valor={inteiro.format(totais.matriculasAtivas)}
            apoio={`${(totais.matriculasAtivas / Math.max(totais.alunosAtivos, 1)).toFixed(2)} por aluno`}
            variacao={variacaoUltimo}
            grafico={
              baseTotal.length > 1 ? (
                <Sparkline
                  values={baseTotal.map((p) => p.matriculas)}
                  label={`Base ativa de ${baseTotal[0].rotulo} a ${baseTotal[baseTotal.length - 1].rotulo}`}
                  className="mt-3 h-9 w-full"
                  color={
                    (variacaoPeriodo ?? 0) < 0
                      ? "hsl(var(--danger))"
                      : "hsl(var(--success))"
                  }
                />
              ) : null
            }
            legenda={
              baseTotal.length > 1 && variacaoPeriodo !== null
                ? `${variacaoPeriodo >= 0 ? "+" : ""}${variacaoPeriodo.toFixed(1)}% desde ${baseTotal[0].rotulo}`
                : undefined
            }
          />
          <Indicador
            rotulo="Famílias pagantes"
            valor={inteiro.format(totais.familias)}
            apoio="responsáveis com matrícula ativa"
          />
          <Indicador
            rotulo="Entradas no mês"
            valor={inteiro.format(totais.entradasNoMes)}
            apoio="matrículas novas"
          />
          <Indicador
            rotulo="Saídas no mês"
            valor={inteiro.format(totais.saidasNoMes)}
            apoio={
              totais.entradasNoMes - totais.saidasNoMes >= 0
                ? `saldo +${totais.entradasNoMes - totais.saidasNoMes}`
                : `saldo ${totais.entradasNoMes - totais.saidasNoMes}`
            }
            alarme={totais.saidasNoMes > totais.entradasNoMes}
          />
          {/*
            A taxa é do último mês FECHADO, não do mês corrente como os dois
            cards ao lado — por isso o mês aparece escrito no apoio. Churn de
            mês pela metade cai todo dia 1º e sobe até o dia 30, e o dono leria
            isso como melhora.
          */}
          <Indicador
            rotulo="Taxa de churn"
            valor={
              churn?.taxa === null || churn === null
                ? "—"
                : `${churn.taxa.toFixed(1)}%`
            }
            apoio={
              churn
                ? `${churn.rotulo}: ${inteiro.format(churn.saidas)} de ${inteiro.format(churn.baseInicial)}`
                : `primeiro mês fechado: ${rotuloDoMes(INICIO_DA_SERIE_DE_CHURN)}`
            }
            legenda={
              churn
                ? "saídas sobre a base do dia 1º"
                : "antes disso, entradas e saídas vinham da planilha"
            }
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            Movimentação financeira
          </h2>
          <p className="text-sm text-muted-foreground">
            Contratado sai do nosso banco. Recebido sai do Asaas, com a chave
            de cada escola — o dinheiro não passa pela plataforma, só a
            consulta.
          </p>
        </div>

        {/*
          Uma barra no lugar de quatro cards.

          Contratado, recebido e a receber não são quatro indicadores lado a
          lado: são pedaços do MESMO total. Em cards separados, R$ 271.282 e
          R$ 904 ganhavam a mesma caixa e o mesmo corpo de fonte, e o olho
          lia duas grandezas comparáveis — quando a segunda é 0,3% da
          primeira. A relação, que é a informação, sobrava para um parágrafo.

          Na barra a proporção É o desenho. O vão cinza não precisa de
          legenda para ser entendido, e os dois cards de "R$ 0" somem: zero
          vira ausência de fatia, que é o que zero significa.
        */}
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <FunilCobranca
            contratado={totais.contratadoDasComLeitura}
            recebido={totais.recebidoNoMes}
            aReceber={totais.aReceberNoMes}
            escolasComLeitura={totais.escolasComLeitura}
            escolas={totais.escolas}
            contratadoSemLeitura={
              totais.contratadoNoMes - totais.contratadoDasComLeitura
            }
            escolasSemLeitura={totais.escolasSemLeitura}
            pctSemCobranca={pctSemCobrancaTexto}
          />

          {/*
            Vencido fica FORA da barra: ele é acumulado de meses anteriores e
            não cabe dentro do contratado deste mês. Enfiá-lo lá dentro
            faria as fatias somarem mais que o total.
          */}
          <Indicador
            rotulo="Vencido em aberto"
            valor={
              totais.escolasComLeitura === 0
                ? "—"
                : dinheiro.format(totais.vencidoEmAberto)
            }
            apoio={
              totais.escolasComLeitura === 0
                ? "sem cobrança emitida, não dá para saber"
                : "acumulado de meses anteriores, não só deste"
            }
            alarme={totais.escolasComLeitura > 0 && totais.vencidoEmAberto > 0}
          />
        </div>

        {historico.naoBuscado ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Sem histórico: {historico.naoBuscado}
          </p>
        ) : null}
      </section>

      <Table containerClassName="mt-6" minWidth="1160px">
        <TableHeader>
          <TableRow>
            <TableHead>Escola</TableHead>
            <TableHead className="text-right tabular-nums">Alunos</TableHead>
            <TableHead className="text-right tabular-nums">Matrículas</TableHead>
            <TableHead className="text-right tabular-nums">Famílias</TableHead>
            <TableHead>Base ativa</TableHead>
            <TableHead className="text-right tabular-nums">Entradas / saídas</TableHead>
            {/*
              A coluna "Faturamento" saiu: era uma sparkline da mesma série
              que "No mês" já resume com a variação percentual ao lado do
              valor. Duas leituras do mesmo dado custavam 130px de largura e
              empurravam Vencido, Saldo e Assinatura para fora da tela.
            */}
            <TableHead className="text-right tabular-nums">No mês</TableHead>
            <TableHead className="text-right tabular-nums">A receber</TableHead>
            <TableHead className="text-right tabular-nums">Vencido</TableHead>
            <TableHead className="text-right tabular-nums">Saldo</TableHead>
            <TableHead>Assinatura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {escolas.length === 0 ? (
            <TableEmpty colSpan={11}>Nenhuma escola cadastrada ainda.</TableEmpty>
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
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {e.matriculasPorAluno.toFixed(2)}/aluno
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {e.familias}
                </TableCell>
                <TableCell>
                  {(basePor.get(e.escolaId)?.length ?? 0) > 1 ? (
                    <>
                      <Sparkline
                        values={(basePor.get(e.escolaId) ?? []).map(
                          (p) => p.matriculas,
                        )}
                        label={`Base ativa de ${e.nome}`}
                        className="h-7 w-24"
                        color={
                          (variacaoDaBase(basePor.get(e.escolaId) ?? []) ?? 0) < 0
                            ? "hsl(var(--danger))"
                            : "hsl(var(--success))"
                        }
                      />
                      {(() => {
                        const v = variacaoDaBase(basePor.get(e.escolaId) ?? []);
                        return v === null ? null : (
                          <span
                            className={`mt-0.5 block text-xs ${v < 0 ? "text-danger-text" : "text-success-text"}`}
                          >
                            {v >= 0 ? "+" : ""}
                            {v.toFixed(1)}%
                          </span>
                        );
                      })()}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="text-success-text">+{e.entradasNoMes}</span>
                  {" / "}
                  <span className={e.saidasNoMes > 0 ? "text-danger-text" : ""}>
                    −{e.saidasNoMes}
                  </span>
                </TableCell>
                {/*
                  A mesma coluna carrega dois números diferentes conforme a
                  escola, então ela SEMPRE diz qual dos dois é — inclusive
                  quando é o recebido. Marcar só a exceção faria quem lê
                  supor que o resto é tudo dinheiro na conta.
                */}
                <TableCell className="text-right tabular-nums">
                  <div>
                    {e.fonteFinanceira === "asaas"
                      ? valor(e.recebidoNoMes)
                      : dinheiro.format(e.contratadoNoMes)}
                  </div>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {e.fonteFinanceira === "asaas" ? "recebido" : "contratado"}
                  </span>
                  {e.fonteFinanceira === "asaas" && variacao !== null ? (
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

      <p className="mt-3 max-w-2xl text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">Contratado</strong>:
        mensalidades ativas menos descontos.{" "}
        <strong className="font-medium text-foreground">Recebido</strong>: pago
        pelo Asaas, confirmado ainda não creditado e recebido em dinheiro —
        líquido, já sem a taxa.
      </p>
    </div>
  );
}

/**
 * O contratado do mês repartido em recebido, a receber e ainda sem cobrança.
 *
 * A fatia cinza é a que importa hoje: mensalidade que existe no sistema mas
 * ainda não virou cobrança no Asaas. Ela é grande porque a migração não
 * terminou — não porque alguém deixou de pagar. Por isso ela é NEUTRA, e não
 * amarela: pintar de alerta um estado conhecido, que vai durar meses, gasta
 * a cor de aviso à toa e ensina o dono a ignorá-la.
 *
 * A barra não substitui o texto por completo — uma linha explica o cinza.
 * Mas é uma linha, e não três, porque a proporção já está desenhada.
 */
function FunilCobranca({
  contratado,
  recebido,
  aReceber,
  escolasComLeitura,
  escolas,
  contratadoSemLeitura,
  escolasSemLeitura,
  pctSemCobranca,
}: {
  contratado: number;
  recebido: number;
  aReceber: number;
  escolasComLeitura: number;
  escolas: number;
  contratadoSemLeitura: number;
  escolasSemLeitura: number;
  pctSemCobranca: string;
}) {
  const semCobranca = Math.max(0, contratado - recebido - aReceber);
  const fatia = (v: number) => (contratado > 0 ? (v / contratado) * 100 : 0);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Contratado no mês
        </p>
        <p className="text-xs text-muted-foreground">
          {escolasComLeitura === escolas
            ? `${inteiro.format(escolas)} ${escolas === 1 ? "escola" : "escolas"}`
            : `${inteiro.format(escolasComLeitura)} de ${inteiro.format(escolas)} escolas com pagamentos`}
        </p>
      </div>

      <p className="mt-2 text-[28px] font-bold leading-[34px] tabular-nums text-foreground">
        {dinheiro.format(contratado)}
      </p>

      {/*
        `minWidth` nas fatias com valor: 0,3% de uma barra de 600px dá menos
        de dois pixels, e some. Uma fatia que existe e não aparece é pior que
        uma fatia levemente fora de escala — o leitor concluiria que não
        entrou nada, quando entrou.
      */}
      <div
        className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`De ${dinheiro.format(contratado)} contratados: ${dinheiro.format(recebido)} recebidos, ${dinheiro.format(aReceber)} a receber e ${dinheiro.format(semCobranca)} ainda sem cobrança emitida.`}
      >
        <div
          className="bg-success"
          style={{
            width: `${fatia(recebido)}%`,
            minWidth: recebido > 0 ? "4px" : undefined,
          }}
        />
        <div
          className="bg-info"
          style={{
            width: `${fatia(aReceber)}%`,
            minWidth: aReceber > 0 ? "4px" : undefined,
          }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        <Fatia
          cor="bg-success"
          rotulo="Recebido"
          valor={dinheiro.format(recebido)}
          apoio={`${fatia(recebido).toFixed(1).replace(".", ",")}%`}
        />
        <Fatia
          cor="bg-info"
          rotulo="A receber"
          valor={dinheiro.format(aReceber)}
          apoio={aReceber > 0 ? "dentro do prazo" : "nada em aberto"}
        />
        <Fatia
          cor="bg-muted-foreground/30"
          rotulo="Sem cobrança"
          valor={dinheiro.format(semCobranca)}
          apoio={`${pctSemCobranca}%`}
        />
      </dl>

      {semCobranca > 0 ? (
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          &ldquo;Sem cobrança&rdquo; não é inadimplência: é mensalidade que
          ainda não foi para o Asaas.
        </p>
      ) : null}

      {escolasSemLeitura > 0 && contratadoSemLeitura > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Fora da barra: {dinheiro.format(contratadoSemLeitura)} contratados em{" "}
          {inteiro.format(escolasSemLeitura)}{" "}
          {escolasSemLeitura === 1 ? "escola sem o módulo" : "escolas sem o módulo"}{" "}
          de pagamentos — sem como saber quanto entrou.
        </p>
      ) : null}
    </Card>
  );
}

/** Uma fatia da barra: ponto colorido, rótulo, valor. */
function Fatia({
  cor,
  rotulo,
  valor,
  apoio,
}: {
  cor: string;
  rotulo: string;
  valor: string;
  apoio: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={`h-2 w-2 shrink-0 rounded-full ${cor}`} aria-hidden />
        {rotulo}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">
        {valor}
      </dd>
      <dd className="text-xs tabular-nums text-muted-foreground">{apoio}</dd>
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
