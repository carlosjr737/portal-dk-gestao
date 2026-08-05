import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Validação de saque — o Asaas pergunta, o portal responde.
 *
 * POR QUE ISTO EXISTE. Toda operação que TIRA dinheiro da conta (saque,
 * estorno, pagamento de conta, Pix, recarga) nasce travada em
 * `AWAITING_CRITICAL_ACTION_AUTHORIZATION`: o valor sai do saldo e a operação
 * não conclui. Sem este endpoint, a liberação dependeria de token SMS, que a
 * escola não tem como usar — ela não acessa o painel do provedor.
 *
 * Com a "Validação de saque via Webhook" habilitada na conta-mãe, o provedor
 * passa a perguntar AQUI antes de processar, e a validação **se estende às
 * subcontas**. É o que torna o saque possível dentro do portal.
 *
 * ┌─ REGRA QUE GOVERNA ESTE ARQUIVO ────────────────────────────────────┐
 * │ Falhar três vezes CANCELA a operação. Então este endpoint não pode  │
 * │ depender de banco, de sessão nem de nada que possa estar fora do ar:│
 * │ ele decide com o que vem no corpo e responde. Uma consulta lenta    │
 * │ aqui vira saque cancelado da escola.                                │
 * └─────────────────────────────────────────────────────────────────────┘
 */

/**
 * Operações que o portal realmente oferece.
 *
 * Esta lista É o controle de segurança. O portal só sabe pedir saque e
 * estorno; se chegar um pedido de pagar boleto, recarregar celular ou pagar
 * QR Code, ou a chave da subconta vazou, ou alguém está usando a conta por
 * fora — e nos dois casos a resposta certa é recusar.
 *
 * Ampliar esta lista é ampliar o que um vazamento de chave consegue fazer.
 */
const PERMITIDAS = new Set(["TRANSFER", "PIX_REFUND"]);

const RECUSA: Record<string, string> = {
  BILL: "Pagamento de contas não é oferecido pelo portal.",
  PIX_QR_CODE: "Pagamento de QR Code não é oferecido pelo portal.",
  MOBILE_PHONE_RECHARGE: "Recarga de celular não é oferecida pelo portal.",
};

export async function POST(request: NextRequest) {
  const esperado = process.env.ASAAS_SAQUE_TOKEN?.trim();

  /*
   * Sem token configurado o endpoint RECUSA, em vez de aprovar.
   *
   * Aprovar por omissão transformaria uma variável de ambiente esquecida em
   * porta aberta para qualquer saída de dinheiro. Recusar trava a operação, o
   * que dá trabalho — mas trabalho é recuperável, dinheiro que saiu não é.
   */
  if (!esperado) {
    console.error("[SAQUE] ASAAS_SAQUE_TOKEN não configurado — recusando");
    return NextResponse.json({
      status: "REFUSED",
      refuseReason: "Validação não configurada no portal.",
    });
  }

  if (request.headers.get("asaas-access-token") !== esperado) {
    console.warn("[SAQUE] token inválido — recusando");
    return NextResponse.json({
      status: "REFUSED",
      refuseReason: "Origem não reconhecida.",
    });
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({
      status: "REFUSED",
      refuseReason: "Pedido ilegível.",
    });
  }

  const tipo = String(corpo.type ?? "");

  if (!PERMITIDAS.has(tipo)) {
    const motivo =
      RECUSA[tipo] ?? `Operação ${tipo || "desconhecida"} não é permitida.`;
    console.warn("[SAQUE] recusado", { tipo, motivo });
    return NextResponse.json({ status: "REFUSED", refuseReason: motivo });
  }

  /*
   * Trilha de auditoria. Vai para o log porque este endpoint não pode tocar o
   * banco (ver a regra no topo) — mas aprovação de saída de dinheiro precisa
   * ficar registrada em algum lugar consultável.
   *
   * PENDENTE: gravar isto numa tabela, de forma assíncrona, sem bloquear a
   * resposta. Enquanto não existir, o log da hospedagem é a única trilha.
   */
  const operacao = (corpo[tipo.toLowerCase()] ??
    corpo.transfer ??
    {}) as Record<string, unknown>;
  console.info("[SAQUE] aprovado", {
    tipo,
    id: operacao.id ?? null,
    valor: operacao.value ?? null,
  });

  return NextResponse.json({ status: "APPROVED" });
}
