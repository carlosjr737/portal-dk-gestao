import Link from "next/link";
import { QrCode } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EstornoBotao } from "@/features/baas/estorno-botao";
import type {
  CobrancaNaTela,
  ContaDigital,
  LinhaExtrato,
  SituacaoCobrancas,
} from "@/features/baas/conta-queries";

/**
 * Conta digital da escola — quanto tenho, de onde veio, como cobro.
 *
 * Componente de servidor de propósito: a única interação da tela é abrir o
 * detalhe de um lançamento, e isso é `<details>` nativo. Marcar o arquivo como
 * cliente só para expandir uma linha mandaria o extrato inteiro para o
 * navegador sem ganho nenhum.
 *
 * NÃO EXISTE BOTÃO DE SAQUE, E É DE PROPÓSITO. O provedor cria a
 * transferência, tira o valor do saldo e para numa autorização que a API não
 * expõe — sem endpoint para autorizar (medido em 04/08/2026, ver adendo do
 * ADR 0001). Um botão aqui prenderia o dinheiro da escola sem nada na tela que
 * a tirasse de lá. Ele entra quando o Asaas destravar.
 */
export function ContaDigitalView({ conta }: { conta: ContaDigital }) {
  const dinheiro = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (conta.estado === "sem_conta") {
    return (
      <div className="mt-6">
        <Alert tone="info">
          Esta escola ainda não tem conta de pagamentos.{" "}
          <Link href="/financeiro/conta-pagamentos" className="font-medium underline">
            Criar agora
          </Link>
        </Alert>
      </div>
    );
  }

  if (conta.estado === "nao_reconhecida") {
    return (
      <div className="mt-6">
        {/*
          Estado terminal. Nunca oferecer "criar outra conta" aqui: criaria uma
          segunda subconta REAL no provedor.
        */}
        <Alert tone="danger">
          {conta.motivo ??
            "O provedor não reconhece mais esta conta — ela foi apagada ou a chave foi revogada."}
        </Alert>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {conta.ambiente !== "production" ? (
        <Alert tone="info">
          Ambiente de testes. Os valores abaixo não são dinheiro real.
        </Alert>
      ) : null}

      {conta.estado === "em_analise" ? (
        <Alert tone="warning">
          A conta ainda está em análise. Dá para cadastrar alunos e turmas, mas
          ela ainda não recebe. Não há nada que você precise fazer agora.
        </Alert>
      ) : null}

      <SaldoCard conta={conta} dinheiro={dinheiro} />
      {conta.situacao ? (
        <SituacaoDasCobrancas situacao={conta.situacao} dinheiro={dinheiro} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Cobrancas cobrancas={conta.cobrancas} dinheiro={dinheiro} />
          <Extrato linhas={conta.extrato} dinheiro={dinheiro} />
        </div>
        <DadosDaConta conta={conta} dinheiro={dinheiro} />
      </div>
    </div>
  );
}

/**
 * As quatro situações, lado a lado.
 *
 * RECEBIDA E CONFIRMADA SÃO CARDS SEPARADOS, e isso é a razão de existir
 * desta faixa. A versão anterior somava as duas sob "Recebido no mês" — e
 * passava a afirmar que a escola tinha recebido dinheiro de cartão que só cai
 * no mês seguinte. Somar os dois números é dizer uma coisa falsa sobre o
 * caixa, que é justamente o que a escola veio conferir aqui.
 *
 * Cada card leva o bruto grande e o líquido embaixo: o bruto é o combinado
 * com a família, o líquido é o que sobra depois da taxa.
 */
function SituacaoDasCobrancas({
  situacao,
  dinheiro,
}: {
  situacao: SituacaoCobrancas;
  dinheiro: (v: number) => string;
}) {
  const faixas = [
    {
      rotulo: "Recebidas",
      ajuda: "Já está na conta",
      dados: situacao.recebidas,
      barra: "bg-success",
      texto: "text-success-text",
    },
    {
      rotulo: "Confirmadas",
      ajuda: "Pago, ainda não caiu",
      dados: situacao.confirmadas,
      barra: "bg-info",
      texto: "text-info-text",
    },
    {
      rotulo: "Aguardando pagamento",
      ajuda: "Ainda no prazo",
      dados: situacao.aguardando,
      barra: "bg-warning",
      texto: "text-warning-text",
    },
    {
      rotulo: "Vencidas",
      ajuda: "Passou do vencimento",
      dados: situacao.vencidas,
      barra: "bg-danger",
      texto: "text-danger-text",
    },
  ];

  const mes = new Date(`${situacao.competencia}-02T00:00:00`).toLocaleDateString(
    "pt-BR",
    { month: "long" },
  );

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground">
        Situação das cobranças
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Com vencimento em {mes}.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {faixas.map((f) => (
          <Card key={f.rotulo} className="flex flex-col gap-3 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {f.rotulo}
              </p>
              <p className={`mt-1.5 text-lg font-semibold tabular-nums ${f.texto}`}>
                {dinheiro(f.dados.valor)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {dinheiro(f.dados.valorLiquido)} líquido
              </p>
            </div>

            {/* Barra em cor cheia: é fatia de estado, não rótulo. */}
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${f.barra}`}
                style={{ width: f.dados.quantidade > 0 ? "100%" : "0%" }}
              />
            </div>

            <p className="text-xs text-muted-foreground tabular-nums">
              {f.dados.quantidade}{" "}
              {f.dados.quantidade === 1 ? "cobrança" : "cobranças"}
              <span className="block text-[11px]">{f.ajuda}</span>
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** Status do provedor traduzido, com o tom que ele merece na tela. */
const STATUS: Record<string, { rotulo: string; tom: "success" | "info" | "warning" | "danger" | "neutral" }> = {
  RECEIVED: { rotulo: "Recebida", tom: "success" },
  RECEIVED_IN_CASH: { rotulo: "Recebida em dinheiro", tom: "success" },
  CONFIRMED: { rotulo: "Confirmada", tom: "info" },
  PENDING: { rotulo: "Aguardando", tom: "warning" },
  OVERDUE: { rotulo: "Vencida", tom: "danger" },
  REFUNDED: { rotulo: "Estornada", tom: "neutral" },
  REFUND_REQUESTED: { rotulo: "Estorno em andamento", tom: "neutral" },
  CHARGEBACK_REQUESTED: { rotulo: "Chargeback", tom: "danger" },
  DELETED: { rotulo: "Removida", tom: "neutral" },
};

const FORMA: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
  UNDEFINED: "A escolher",
};

/**
 * Cobranças emitidas, com o estorno.
 *
 * Fica antes das movimentações de propósito: é aqui que existe uma AÇÃO. Uma
 * cobrança de cartão confirmada ainda não gerou lançamento nenhum no extrato
 * — o dinheiro só cai no mês seguinte —, então quem quisesse desfazê-la não
 * teria onde clicar se a tela mostrasse apenas o movimento do dinheiro.
 */
function Cobrancas({
  cobrancas,
  dinheiro,
}: {
  cobrancas: CobrancaNaTela[];
  dinheiro: (v: number) => string;
}) {
  const ESTORNAVEL = ["RECEIVED", "CONFIRMED"];

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">Cobranças</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          As últimas emitidas por esta escola.
        </p>
      </div>

      {cobrancas.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Nenhuma cobrança emitida ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {cobrancas.map((c) => {
            const s = STATUS[c.status] ?? { rotulo: c.status, tom: "neutral" as const };
            const podeEstornar = ESTORNAVEL.includes(c.status) && !c.estornada;
            const taxa = Math.max(0, c.valor - c.valorLiquido);

            /*
             * Estorno pedido mas ainda não concluído.
             *
             * O provedor aceita o pedido, tira o valor do saldo e deixa o
             * refund em `AWAITING_CRITICAL_ACTION_AUTHORIZATION` — a mesma
             * trava do saque. Sem dizer isso, a escola vê o dinheiro sumir do
             * saldo, a cobrança continuar "Recebida", e conclui que quebrou.
             */
            const estornoPendente = c.estornada && c.status !== "REFUNDED";

            return (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.pagador ?? c.descricao ?? "Cobrança"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {FORMA[c.formaPagamento] ?? c.formaPagamento} · vence{" "}
                    {c.vencimento.split("-").reverse().join("/")}
                    {/* Cartão confirmado só vira dinheiro no mês seguinte —
                        dizer quando é o que evita a pergunta na secretaria. */}
                    {c.status === "CONFIRMED" && c.creditoEm ? (
                      <> · cai em {c.creditoEm.split("-").reverse().join("/")}</>
                    ) : null}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={s.tom}>{s.rotulo}</Badge>
                    {estornoPendente ? (
                      <Badge tone="warning">Estorno aguardando liberação</Badge>
                    ) : null}
                  </div>
                  {estornoPendente ? (
                    <p className="mt-1.5 max-w-[46ch] text-xs text-warning-text">
                      O valor já saiu do saldo. O provedor exige uma liberação
                      que ainda não está disponível por aqui.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {dinheiro(c.valor)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {dinheiro(c.valorLiquido)} líquido
                    </p>
                  </div>
                  {podeEstornar ? (
                    <EstornoBotao
                      paymentId={c.id}
                      valor={c.valor}
                      taxa={taxa}
                      pagador={c.pagador ?? "quem pagou"}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function SaldoCard({
  conta,
  dinheiro,
}: {
  conta: ContaDigital;
  dinheiro: (v: number) => string;
}) {
  const zerado = conta.saldo <= 0;

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Saldo disponível
          </p>
          {/*
            O número grande é o LÍQUIDO. O bruto nunca ganha este tamanho —
            mostrá-lo aqui infla o que a escola acha que ganhou.
          */}
          <p className="mt-2 text-[28px] font-bold leading-[34px] text-foreground tabular-nums">
            {dinheiro(conta.saldo)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {zerado
              ? "Nenhuma cobrança recebida ainda. Isso não é erro."
              : "Já com as taxas descontadas. É o que dá para usar agora."}
          </p>
        </div>

        <Link
          href="/financeiro/conta/cobrar"
          className={buttonVariants({ className: "h-11 gap-2" })}
        >
          <QrCode className="h-4 w-4" aria-hidden />
          Cobrar por QR Code
        </Link>
      </div>
    </Card>
  );
}

function Extrato({
  linhas,
  dinheiro,
}: {
  linhas: LinhaExtrato[];
  dinheiro: (v: number) => string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Movimentações da conta
        </h2>
        {/*
          Isto é o dinheiro que ENTROU E SAIU, não a lista de cobranças. Uma
          cobrança de cartão confirmada ainda não aparece aqui: ela só vira
          movimento quando o valor é creditado, no mês seguinte. Chamar as duas
          coisas de "extrato" foi o que fez a tela parecer vazia tendo cobrança
          paga.
        */}
        <p className="mt-0.5 text-xs text-muted-foreground">
          Entradas e saídas de dinheiro. Abra para ver o que foi descontado.
        </p>
      </div>

      {linhas.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Nada entrou nem saiu ainda. Cobrança paga no cartão só aparece aqui
          quando o valor é creditado.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {linhas.map((l) => {
            const entrada = l.valor >= 0;
            const temDetalhe = l.detalhes.length > 1;

            const cabecalho = (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {l.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {l.data.split("-").reverse().join("/")}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      entrada ? "text-success-text" : "text-foreground"
                    }`}
                  >
                    {entrada ? "+" : "−"} {dinheiro(Math.abs(l.valor))}
                  </p>
                  {/* A coluna de saldo tem que fechar linha a linha — extrato
                      cujo saldo não fecha é extrato em que ninguém confia. */}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    saldo {dinheiro(l.saldoApos)}
                  </p>
                </div>
              </div>
            );

            return (
              <li key={l.id}>
                {temDetalhe ? (
                  /*
                    `<details>` nativo em vez de estado em React: a tela inteira
                    continua sendo servidor, e a linha abre sem JavaScript.
                  */
                  <details className="group">
                    <summary className="cursor-pointer list-none px-5 py-3.5 marker:content-none hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                      {cabecalho}
                      <span className="mt-1 inline-block text-xs font-medium text-primary">
                        <span className="group-open:hidden">Ver o que foi descontado</span>
                        <span className="hidden group-open:inline">Ocultar detalhe</span>
                      </span>
                    </summary>
                    <dl className="mx-5 mb-4 space-y-1.5 rounded-md border border-border bg-muted/40 px-4 py-3">
                      {l.detalhes.map((d, i) => (
                        <div key={i} className="flex justify-between gap-4 text-xs">
                          <dt className="text-muted-foreground">{d.rotulo}</dt>
                          <dd className="font-medium text-foreground tabular-nums">
                            {d.valor >= 0 ? "+" : "−"} {dinheiro(Math.abs(d.valor))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : (
                  <div className="px-5 py-3.5">{cabecalho}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function DadosDaConta({
  conta,
  dinheiro,
}: {
  conta: ContaDigital;
  dinheiro: (v: number) => string;
}) {
  const b = conta.dadosBancarios;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Dados da conta</h2>
        {b ? (
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Agência</dt>
              <dd className="font-medium text-foreground tabular-nums">{b.agencia}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Conta</dt>
              <dd className="font-medium text-foreground tabular-nums">
                {b.conta}-{b.digito}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Disponível quando a conta for aprovada.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Taxas</h2>
        {/*
          "Taxa da plataforma", nunca "tarifa" — a Resolução Conjunta 16
          (Art. 8º XI) veda apresentar a cobrança como tarifa bancária.
        */}
        <p className="mt-0.5 text-xs text-muted-foreground">
          Descontadas de cada recebimento.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Recebimento por Pix</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {conta.taxas.pix === null ? "—" : dinheiro(conta.taxas.pix)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Recebimento por boleto</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {conta.taxas.boleto === null ? "—" : dinheiro(conta.taxas.boleto)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Saque</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          A transferência do saldo para a conta bancária da escola ainda não
          está liberada pelo provedor. Assim que estiver, ela aparece aqui.
        </p>
        <div className="mt-3">
          <Badge tone="neutral">Em breve</Badge>
        </div>
      </Card>
    </div>
  );
}
