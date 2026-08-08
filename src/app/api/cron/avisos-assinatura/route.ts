import { NextResponse, type NextRequest } from "next/server";
import { varrerAvisosDeAssinatura } from "@/features/plataforma/avisos-assinatura";

export const dynamic = "force-dynamic";
// Um POST ao provedor de e-mail por escola avisada, em série.
export const maxDuration = 300;

/**
 * Varre as assinaturas e manda os avisos que o relógio criou. Roda todo dia.
 *
 * O motivo de existir está em `avisos-assinatura.ts`: a suspensão acontece
 * pela passagem do tempo, e tempo não dispara webhook. Sem esta rota, a escola
 * descobre que perdeu o acesso ao tentar entrar.
 *
 * Rodar de novo no mesmo dia é seguro: `ultimo_aviso` guarda o que já saiu,
 * então a segunda passada não encontra nada para mandar.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();

  // Mesma postura do lote de faturamento: sem segredo, recusa. Aberto,
  // qualquer um dispararia e-mail de cobrança para a base inteira.
  if (!segredo) {
    console.error("[AVISOS] CRON_SECRET não configurado");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const inicio = Date.now();
  const relatorio = await varrerAvisosDeAssinatura();

  const nivel = relatorio.falhas > 0 ? console.error : console.info;
  nivel("[AVISOS] varredura concluída", {
    ...relatorio,
    segundos: Math.round((Date.now() - inicio) / 1000),
  });

  return NextResponse.json(relatorio);
}
