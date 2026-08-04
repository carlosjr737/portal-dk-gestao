import Link from "next/link";
import { QrCode } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { ContaDigital, LinhaExtrato } from "@/features/baas/conta-queries";

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
      {conta.resumo ? <FaixaResumo conta={conta} dinheiro={dinheiro} /> : null}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Extrato linhas={conta.extrato} dinheiro={dinheiro} />
        <DadosDaConta conta={conta} dinheiro={dinheiro} />
      </div>
    </div>
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

/**
 * Recebido nunca aparece sozinho.
 *
 * Sem o denominador — quantas cobranças foram emitidas —, uma escola com
 * poucos contratos no sistema parece estar levando calote. O número sozinho
 * mente por falta de contexto.
 */
function FaixaResumo({
  conta,
  dinheiro,
}: {
  conta: ContaDigital;
  dinheiro: (v: number) => string;
}) {
  const r = conta.resumo!;
  const mes = new Date(`${r.competencia}-02T00:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recebido em {mes}
        </p>
        <p className="mt-1.5 text-lg font-semibold text-foreground tabular-nums">
          {dinheiro(r.recebido)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {r.cobrancasRecebidas} de {r.cobrancasEmitidas} cobranças emitidas
        </p>
      </Card>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          A receber
        </p>
        <p className="mt-1.5 text-lg font-semibold text-foreground tabular-nums">
          {dinheiro(r.aReceber)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {r.cobrancasEmAberto}{" "}
          {r.cobrancasEmAberto === 1 ? "cobrança em aberto" : "cobranças em aberto"}
        </p>
      </Card>
    </div>
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
        <h2 className="text-sm font-semibold text-foreground">Extrato</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cada cobrança é uma linha. Abra para ver o que foi descontado.
        </p>
      </div>

      {linhas.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Nenhum lançamento ainda.
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
