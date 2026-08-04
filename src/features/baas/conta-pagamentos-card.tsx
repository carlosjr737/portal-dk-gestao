import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AsaasSelo } from "@/components/brand/asaas-selo";

/**
 * Estado da conta de pagamentos, no cadastro da escola.
 *
 * Era um cartão com o fluxo inteiro dentro: formulário de criação, botão de
 * verificar e lista de documentos, tudo empilhado numa tela cujo assunto é
 * outro. O fluxo mudou para `/configuracoes/conta-pagamentos`, e aqui fica só
 * o estado e o caminho — que é o que alguém procura ao abrir "Minha escola".
 *
 * Deixar o fluxo aqui tinha um custo concreto: a tela dizia quais campos
 * faltavam e os campos viviam no formulário logo acima, sem ligação nenhuma
 * entre os dois. A pessoa lia o diagnóstico e saía procurando a cura.
 */

const ROTULO: Record<string, { texto: string; tom: "success" | "warning" | "danger" | "neutral" }> = {
  aprovada: { texto: "Aprovada", tom: "success" },
  analise: { texto: "Em análise", tom: "warning" },
  recusada: { texto: "Recusada", tom: "danger" },
  pendente: { texto: "Não criada", tom: "neutral" },
};

export function ContaPagamentosCard({
  kycStatus,
  accountId,
  ambiente,
}: {
  kycStatus: string | null;
  accountId: string | null;
  walletId?: string | null;
  ambiente: string;
}) {
  const criada = Boolean(accountId);
  const status = ROTULO[kycStatus ?? "pendente"] ?? ROTULO.pendente;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            Conta de pagamentos
            <Badge tone={status.tom}>{status.texto}</Badge>
            {ambiente !== "production" ? (
              <Badge tone="neutral">testes</Badge>
            ) : null}
          </h2>

          {criada ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {accountId}
            </p>
          ) : (
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Necessária só para <strong>cobrar as mensalidades pelo
              sistema</strong>. Sem ela o portal segue funcionando para alunos,
              turmas e chamada, e a cobrança continua sendo feita por fora.
            </p>
          )}
        </div>

        <Link
          href="/configuracoes/conta-pagamentos"
          className={buttonVariants({
            variant: criada ? "outline" : "default",
            size: "sm",
          })}
        >
          {criada ? "Ver detalhes" : "Criar conta"}
        </Link>
      </div>

      {criada ? (
        <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
          <AsaasSelo fundo="claro" tamanho="sm" />
          <p className="text-xs text-muted-foreground">
            Conta aberta e mantida pelo Asaas, instituição de pagamento
            autorizada.
          </p>
        </div>
      ) : null}
    </div>
  );
}
