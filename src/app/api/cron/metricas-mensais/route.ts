import { NextResponse, type NextRequest } from "next/server";
import {
  capturarTodasAsEscolas,
  competenciaFechada,
} from "@/features/metricas/captura";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Tira a foto mensal das métricas. Roda todo dia 1.
 *
 * ┌─ POR QUE O DIA 1, E POR QUE ISSO NÃO PODE FALHAR CALADO ────────────┐
 * │ A captura fotografa o estado do momento em que roda. No dia 1, esse │
 * │ estado ainda é praticamente o do mês que fechou. No dia 15 já não   │
 * │ é: matrícula cancelada no meio do mês some da conta, e o retrato    │
 * │ sai menor do que a realidade de dezembro.                           │
 * │                                                                     │
 * │ E o mês perdido não se recupera. Receita reconstruída depois usa o  │
 * │ `monthly_amount` de HOJE — se a mensalidade mudou, o número que     │
 * │ voltaria nunca foi verdade. Por isso a resposta lista escola por    │
 * │ escola: silêncio aqui é um buraco permanente no histórico.          │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Rodar de novo no mesmo dia é seguro: sobrescreve com o mesmo número.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();

  if (!segredo) {
    console.error("[METRICAS] CRON_SECRET não configurado");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Permite refazer uma competência específica quando o dia 1 falhou.
  const competencia =
    request.nextUrl.searchParams.get("competencia") ?? competenciaFechada();

  if (!/^\d{4}-\d{2}$/.test(competencia)) {
    return NextResponse.json({ error: "competencia_invalida" }, { status: 400 });
  }

  const inicio = Date.now();
  const resultados = await capturarTodasAsEscolas(competencia);
  const falhas = resultados.filter((r) => r.erro);

  const nivel = falhas.length > 0 ? console.error : console.info;
  nivel("[METRICAS] captura concluída", {
    competencia,
    escolas: resultados.length,
    falhas: falhas.length,
    segundos: Math.round((Date.now() - inicio) / 1000),
  });

  return NextResponse.json({
    competencia,
    escolas: resultados.length,
    gravadas: resultados.reduce((s, r) => s + r.gravadas, 0),
    falhas,
  });
}
