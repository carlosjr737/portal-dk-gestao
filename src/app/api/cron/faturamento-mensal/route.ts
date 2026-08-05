import { NextResponse, type NextRequest } from "next/server";
import {
  competenciaAtual,
  gerarCobrancasDeTodasAsEscolas,
} from "@/features/baas/faturamento-mensal";

export const dynamic = "force-dynamic";
// O lote fala com o provedor uma vez por contrato; com muitas escolas isso
// passa do limite padrão de 10s da hospedagem.
export const maxDuration = 300;

/**
 * Gera as cobranças do mês. Roda todo dia 1.
 *
 * ┌─ O RISCO QUE ESTE ENDPOINT CRIA ────────────────────────────────────┐
 * │ Antes, a assinatura do provedor nunca esquecia de cobrar. Agora     │
 * │ quem cobra somos nós — e se este lote falhar no dia 1 sem ninguém   │
 * │ perceber, a escola simplesmente não fatura o mês.                   │
 * │                                                                     │
 * │ Por isso ele devolve o relatório do que fez, e falha de contrato    │
 * │ individual fica gravada em `cobranca_mensal` com o motivo. Silêncio │
 * │ aqui é o pior resultado possível.                                   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Rodar de novo é seguro: `cobranca_mensal` tem unicidade em
 * (contrato, competência), então quem já foi cobrado é pulado.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();

  /*
   * Sem segredo configurado o endpoint RECUSA.
   *
   * Aberto, qualquer um dispararia a emissão de cobrança de todas as escolas
   * — e cobrança emitida por engano é conversa com a família, não um registro
   * que se apaga.
   */
  if (!segredo) {
    console.error("[FATURAMENTO] CRON_SECRET não configurado");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Permite reprocessar um mês específico quando o dia 1 falhou.
  const competencia =
    request.nextUrl.searchParams.get("competencia") ?? competenciaAtual();

  if (!/^\d{4}-\d{2}$/.test(competencia)) {
    return NextResponse.json({ error: "competencia_invalida" }, { status: 400 });
  }

  const inicio = Date.now();
  const resultados = await gerarCobrancasDeTodasAsEscolas(competencia);

  const total = resultados.reduce(
    (acc, r) => ({
      geradas: acc.geradas + r.geradas,
      puladas: acc.puladas + r.puladas,
      falhas: acc.falhas + r.falhas.length,
    }),
    { geradas: 0, puladas: 0, falhas: 0 },
  );

  const nivel = total.falhas > 0 ? console.error : console.info;
  nivel("[FATURAMENTO] lote concluído", {
    competencia,
    ...total,
    segundos: Math.round((Date.now() - inicio) / 1000),
  });

  return NextResponse.json({ competencia, ...total, escolas: resultados });
}
