import { NextResponse, type NextRequest } from "next/server";
import { varrerAvisosDeAssinatura } from "@/features/plataforma/avisos-assinatura";
import { enviarEmail } from "@/features/email/client";
import { isPlatformOwner } from "@/features/plataforma/auth";

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
  const temSegredo =
    Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;

  /*
   * TESTE DE ENCANAMENTO: ?teste=alguem@dominio.com
   *
   * Existe porque, sem ele, a única forma de saber se o envio funciona é
   * cadastrar um usuário de verdade ou esperar uma assinatura vencer — quer
   * dizer, sujar o banco ou torcer. Ele não olha assinatura nenhuma: só
   * pergunta se a chave está configurada e se o provedor aceita o remetente,
   * que é exatamente o que costuma estar quebrado.
   *
   * ACEITA O DONO DA PLATAFORMA LOGADO, e não só o segredo do cron. O motivo é
   * concreto: na Vercel, variável marcada como "Sensitive" nunca mais é
   * exibida nem exportada — nem no painel, nem por `vercel env pull`, que
   * devolve `[SENSITIVE]`. Quem configurou o CRON_SECRET não consegue lê-lo de
   * volta, e exigir esse valor transformaria um teste de dois minutos em
   * rotacionar um segredo de produção. O dono da plataforma já enxerga todas
   * as escolas; mandar um e-mail para um endereço que ele digitou não amplia
   * poder nenhum.
   *
   * A resposta devolve o motivo cru do provedor. É o que transforma "não
   * chegou" em "domínio não verificado" ou "chave inválida".
   */
  const teste = request.nextUrl.searchParams.get("teste");
  if (teste) {
    if (!temSegredo && !(await isPlatformOwner())) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const envio = await enviarEmail({
      para: teste,
      assunto: "Teste de envio — SouAle",
      html: "<p>Se este e-mail chegou, o envio automático está funcionando.</p>",
      texto: "Se este e-mail chegou, o envio automático está funcionando.",
    });
    return NextResponse.json({ teste, remetente: process.env.EMAIL_REMETENTE ?? "(padrão)", ...envio });
  }

  /*
   * A VARREDURA continua só com o segredo. Ela fala com a base inteira, e o
   * dono logado não precisa dela: o cron roda todo dia sozinho.
   */
  if (!segredo) {
    console.error("[AVISOS] CRON_SECRET não configurado");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!temSegredo) {
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
