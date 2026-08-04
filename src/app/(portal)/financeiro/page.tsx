import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getFaturamentoDoMes } from "@/features/faturamento/queries";
import { getCurrentEscolaId } from "@/features/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASAAS_ENV } from "@/features/baas/config";

export const dynamic = "force-dynamic";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const inteiro = new Intl.NumberFormat("pt-BR");

/**
 * Estado da conta de pagamentos, resumido para o topo desta tela.
 *
 * Só aparece quando há algo a dizer: conta aprovada não vira aviso, senão o
 * alerta ficaria permanente e a pessoa aprenderia a não ler os alertas desta
 * tela — inclusive os que importam.
 */
async function estadoDaConta() {
  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { mostrar: false as const };

  const admin = createAdminClient();
  const { data } = await admin
    .from("school_payment_credentials")
    .select("account_id, kyc_status")
    .eq("escola_id", escolaId)
    .eq("environment", ASAAS_ENV)
    .maybeSingle();

  const status = (data?.kyc_status as string | null) ?? null;

  if (!data?.account_id) {
    return {
      mostrar: true as const,
      tom: "info" as const,
      texto:
        "Esta escola ainda não tem conta de pagamentos — a cobrança automática não sai sem ela.",
    };
  }
  if (status === "aprovada") return { mostrar: false as const };
  if (status === "recusada") {
    return {
      mostrar: true as const,
      tom: "danger" as const,
      texto: "O Asaas recusou o cadastro da conta de pagamentos.",
    };
  }
  return {
    mostrar: true as const,
    tom: "warning" as const,
    texto:
      "Conta de pagamentos em análise no Asaas. Até sair o resultado, a cobrança automática não é emitida.",
  };
}

export default async function FinanceiroPage() {
  const [f, conta] = await Promise.all([
    getFaturamentoDoMes(),
    estadoDaConta(),
  ]);

  const mes = new Date(`${f.competencia}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const semCobranca = Math.max(0, f.contratado - f.contratadoCoberto);
  const pctCobertura =
    f.matriculasAtivas > 0
      ? (f.matriculasCobertas / f.matriculasAtivas) * 100
      : 0;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description={`Faturamento e recebimento de ${mes}.`}
      />

      {/*
        Conta não aprovada aparece AQUI, não só em Configurações.
        É ela que bloqueia a cobrança automática — e esconder isso num
        submenu faz a pessoa procurar bug onde não tem, olhando para um
        recebimento que nunca sai porque a conta ainda está em análise.
      */}
      {conta.mostrar ? (
        <Alert tone={conta.tom} className="mt-6">
          {conta.texto}{" "}
          <Link
            href="/configuracoes/conta-pagamentos"
            className="font-medium underline underline-offset-2"
          >
            Ver a conta de pagamentos
          </Link>
        </Alert>
      ) : null}

      {f.modeloPendente ? (
        <Alert tone="warning" className="mt-6">
          O modelo de recebimento ainda não existe no banco. O faturamento
          contratado abaixo está correto; recebimento e conciliação só passam a
          funcionar depois de rodar{" "}
          <code className="font-mono text-xs">
            scripts/recebimento_01_modelo.sql
          </code>
          .
        </Alert>
      ) : null}

      {/*
        Faturamento contratado vem primeiro e sozinho, porque é o único número
        desta tela que independe de integração: matrícula ativa × mensalidade.
        Toda escola tem, desde o primeiro dia, com Asaas ou sem — e era
        justamente ele que sumia quando `usa_pagamentos` desligava o módulo.
      */}
      <Card className="mt-6 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Faturamento contratado
        </p>
        <p className="mt-2 text-[32px] font-bold leading-[38px] tabular-nums text-foreground">
          {dinheiro.format(f.contratado)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {inteiro.format(f.matriculasAtivas)} matrículas ativas · mensalidades
          já com desconto
        </p>
      </Card>

      {/*
        A LINHA DE COBERTURA É OBRIGATÓRIA.

        Sem ela, "recebido" seria lido contra o faturamento inteiro, e uma
        escola com poucos contratos no sistema pareceria estar levando calote
        de quase tudo. A causa seria outra: o sistema não acompanha aquelas
        cobranças. A linha diz de quantas matrículas o número está falando, e
        é o que torna o recebimento interpretável.
      */}
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cobrança pelo sistema
          </p>
          <p className="text-xs text-muted-foreground">
            {inteiro.format(f.matriculasCobertas)} de{" "}
            {inteiro.format(f.matriculasAtivas)} matrículas (
            {pctCobertura.toFixed(pctCobertura > 0 && pctCobertura < 1 ? 1 : 0)}%)
          </p>
        </div>

        <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
          {dinheiro.format(f.contratadoCoberto)}
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">No Asaas</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {inteiro.format(f.matriculasNoAsaas)} matrículas
            </dd>
            <dd className="text-xs text-muted-foreground">
              baixa automática pelo webhook
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Conciliado à mão</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {dinheiro.format(f.recebidoManual)}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {inteiro.format(f.marcacoesManuais)} marcações neste mês
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fora do sistema</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {dinheiro.format(semCobranca)}
            </dd>
            <dd className="text-xs text-muted-foreground">
              conta no faturamento, não no recebimento
            </dd>
          </div>
        </dl>

        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          &ldquo;Fora do sistema&rdquo; não é inadimplência: é contrato cuja
          cobrança o sistema não acompanha.
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold text-foreground">
          Operações financeiras
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/financeiro/inadimplencia" className={buttonVariants()}>
            Inadimplência
          </Link>
          <Link
            href="/financeiro/growth-churn"
            className={buttonVariants({ variant: "outline" })}
          >
            Growth &amp; Churn
          </Link>
          <Link
            href="/financeiro/configuracoes"
            className={buttonVariants({ variant: "outline" })}
          >
            Configurações financeiras
          </Link>
        </div>
      </Card>
    </div>
  );
}
