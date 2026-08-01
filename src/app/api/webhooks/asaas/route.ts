import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAsaasWebhookToken } from "@/features/baas/config";
import { processarEventoPagamento } from "@/features/plataforma/webhook-handler";

export const dynamic = "force-dynamic";

/**
 * Webhook de pagamentos do Asaas.
 *
 * REGRA QUE GOVERNA ESTE ARQUIVO: responder 2xx quase sempre.
 * O provedor interrompe a fila inteira após 15 falhas consecutivas — e aí
 * para de entregar QUALQUER evento, até religarem na mão. Então erro nosso
 * (evento desconhecido, assinatura não encontrada, falha ao processar) não
 * pode virar resposta de erro: gravamos o evento, respondemos 200 e tratamos
 * depois. Só o token inválido responde 401, porque aí não é o Asaas chamando.
 */
export async function POST(request: NextRequest) {
  const tokenEsperado = getAsaasWebhookToken();

  // Sem token configurado, o endpoint fica fechado. Aceitar qualquer chamada
  // permitiria forjar "pagamento recebido" e liberar acesso de graça.
  if (!tokenEsperado) {
    console.error("[WEBHOOK ASAAS] ASAAS_WEBHOOK_TOKEN não configurado");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const tokenRecebido = request.headers.get("asaas-access-token");
  if (tokenRecebido !== tokenEsperado) {
    console.warn("[WEBHOOK ASAAS] token inválido");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    // Corpo ilegível: 200 mesmo assim — reenviar não resolveria.
    console.error("[WEBHOOK ASAAS] corpo inválido");
    return NextResponse.json({ received: true, ignored: "invalid_body" });
  }

  const eventId = String(body.id ?? "");
  const event = String(body.event ?? "");
  const payment = (body.payment ?? {}) as Record<string, unknown>;
  const paymentId = (payment.id as string | undefined) ?? null;
  const subscriptionId = (payment.subscription as string | undefined) ?? null;
  const dueDate = (payment.dueDate as string | undefined) ?? null;

  if (!eventId || !event) {
    return NextResponse.json({ received: true, ignored: "missing_id_or_event" });
  }

  const admin = createAdminClient();

  // Grava primeiro. A PK no id do evento torna a reentrega inofensiva:
  // se já existe, não processa de novo.
  const { error: insertError } = await admin.from("webhook_evento").insert({
    id: eventId,
    provider: "asaas",
    event,
    payment_id: paymentId,
    subscription_id: subscriptionId,
    payload: body,
  });

  if (insertError) {
    // 23505 = chave duplicada -> já recebemos este evento antes.
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicated: true });
    }
    console.error("[WEBHOOK ASAAS] falha ao gravar evento", insertError);
    // Aqui vale pedir reenvio: o evento não ficou registrado em lugar nenhum.
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  try {
    const r = await processarEventoPagamento({
      id: eventId,
      event,
      subscriptionId,
      paymentId,
      dueDate,
    });
    await admin
      .from("webhook_evento")
      .update({ processado_em: new Date().toISOString(), erro: null })
      .eq("id", eventId);

    return NextResponse.json({ received: true, aplicado: r.aplicado, detalhe: r.detalhe });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[WEBHOOK ASAAS] falha ao processar", { eventId, event, msg });
    await admin.from("webhook_evento").update({ erro: msg }).eq("id", eventId);

    // 200 de propósito: o evento está salvo e pode ser reprocessado. Devolver
    // erro aqui só aproximaria a fila do bloqueio, sem ganho nenhum.
    return NextResponse.json({ received: true, processing_failed: true });
  }
}
