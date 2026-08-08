import "server-only";

import type { Email } from "@/features/email/client";
import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/branding";

/**
 * As mensagens automáticas.
 *
 * TEXTO E HTML SEMPRE, nunca só um. Cliente corporativo bloqueia HTML por
 * padrão, e mensagem que chega em branco para o financeiro da escola é a que
 * mais importa não chegar em branco.
 *
 * HTML DE 2005, DE PROPÓSITO: tabela, estilo em linha, sem classe e sem
 * flexbox. Gmail e Outlook descartam `<style>` no `<head>` e não entendem
 * grid — o que renderiza bonito no navegador chega quebrado na caixa de
 * entrada.
 *
 * A COR VEM COPIADA, e é a única exceção à regra de "nenhum hex em
 * componente" do manual: e-mail não tem acesso ao CSS do produto, então o
 * Índigo e o Cobalto entram literais. Os valores estão no
 * `docs/identidade-visual.md` — se mudarem lá, mudam aqui à mão.
 *
 * NENHUMA MENSAGEM PEDE DADO SENSÍVEL nem manda anexo. E-mail de cobrança é
 * o disfarce favorito de golpe; quanto mais parecido com "clique aqui e
 * confirme seus dados", pior. Todas levam a pessoa para o site, e nada mais.
 */

const INDIGO = "#25265B";
const COBALTO = "#5B5CE2";
const TEXTO = "#1A1A2E";
const CINZA = "#5B6478";
const BORDA = "#E2E5EC";

function moldura(conteudo: string, previa: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F6F7FB;">
<!-- A prévia é o que aparece na lista da caixa de entrada, antes de abrir.
     Sem ela, o cliente de e-mail mostra o começo do HTML. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previa}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7FB;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid ${BORDA};border-radius:12px;">
  <tr><td style="padding:24px 28px 0;">
    <span style="font:600 18px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${INDIGO};">Sou<span style="color:${COBALTO};font-weight:800;">Ale</span></span>
  </td></tr>
  <tr><td style="padding:20px 28px 28px;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${TEXTO};">
${conteudo}
  </td></tr>
</table>
<p style="max-width:520px;margin:16px auto 0;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${CINZA};text-align:center;">
  ${PLATFORM_NAME} · <a href="${PLATFORM_URL}" style="color:${CINZA};">souale.com.br</a><br>
  Você recebeu este e-mail porque tem acesso ao sistema da sua escola.
</p>
</td></tr></table></body></html>`;
}

function botao(href: string, rotulo: string): string {
  /* <a> com padding, não <button>: Outlook não renderiza botão em e-mail. */
  return `<p style="margin:24px 0 0;"><a href="${href}" style="display:inline-block;background:${COBALTO};color:#FFFFFF;text-decoration:none;font:600 15px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:14px 24px;border-radius:8px;">${rotulo}</a></p>`;
}

const dinheiro = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/* ─────────────────────────────────────────────────────────────────────────
   1. Acesso criado — escola nova
   ───────────────────────────────────────────────────────────────────────── */

export function emailAcessoCriado(p: {
  para: string;
  nomeEscola: string;
  linkAcesso: string;
}): Email {
  const previa = `Defina sua senha e comece a usar o ${PLATFORM_NAME}.`;
  return {
    para: p.para,
    assunto: `Seu acesso ao ${PLATFORM_NAME} está pronto`,
    texto: `Olá!

A conta da ${p.nomeEscola} foi criada no ${PLATFORM_NAME}.

Defina sua senha por este link:
${p.linkAcesso}

O link vale por tempo limitado. Se expirar, use "Esqueci minha senha" em ${PLATFORM_URL}/login.

Qualquer dúvida, é só responder este e-mail.`,
    html: moldura(
      `<p style="margin:0 0 12px;font-size:19px;font-weight:600;">Seu acesso está pronto</p>
<p style="margin:0;">A conta da <strong>${p.nomeEscola}</strong> foi criada. Defina sua senha para entrar.</p>
${botao(p.linkAcesso, "Definir minha senha")}
<p style="margin:20px 0 0;font-size:13px;color:${CINZA};">O link vale por tempo limitado. Se expirar, use &ldquo;Esqueci minha senha&rdquo; na tela de entrada.</p>`,
      previa,
    ),
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   2. Usuário novo dentro da escola
   ───────────────────────────────────────────────────────────────────────── */

export function emailUsuarioCriado(p: {
  para: string;
  nomePessoa: string;
  nomeEscola: string;
  papel: string;
}): Email {
  const previa = `Você foi adicionado ao sistema da ${p.nomeEscola}.`;
  return {
    para: p.para,
    assunto: `Você foi adicionado ao sistema da ${p.nomeEscola}`,
    texto: `Olá, ${p.nomePessoa}!

Você foi adicionado ao sistema da ${p.nomeEscola} como ${p.papel}.

Entre em ${PLATFORM_URL}/login com este e-mail. A senha inicial foi definida por quem criou seu acesso — peça a ela, e troque depois de entrar.

Nunca pedimos senha por e-mail.`,
    html: moldura(
      `<p style="margin:0 0 12px;font-size:19px;font-weight:600;">Você tem acesso ao sistema</p>
<p style="margin:0;">Olá, ${p.nomePessoa}. Você foi adicionado ao sistema da <strong>${p.nomeEscola}</strong> como <strong>${p.papel}</strong>.</p>
${botao(`${PLATFORM_URL}/login`, "Entrar no sistema")}
<p style="margin:20px 0 0;font-size:13px;color:${CINZA};">A senha inicial foi definida por quem criou seu acesso — peça a ela e troque depois de entrar. <strong>Nunca pedimos senha por e-mail.</strong></p>`,
      previa,
    ),
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   3. Assinatura paga
   ───────────────────────────────────────────────────────────────────────── */

export function emailAssinaturaConfirmada(p: {
  para: string;
  nomeEscola: string;
  valor: number;
  proximoVencimento: string | null;
}): Email {
  const previa = `Recebemos o pagamento de ${dinheiro(p.valor)}.`;
  const proxima = p.proximoVencimento
    ? `A próxima cobrança vence em ${dataBR(p.proximoVencimento)}.`
    : "";
  return {
    para: p.para,
    assunto: `Pagamento confirmado — ${PLATFORM_NAME}`,
    texto: `Recebemos o pagamento da assinatura da ${p.nomeEscola}.

Valor: ${dinheiro(p.valor)}
${proxima}

Nada a fazer — o acesso segue normal.`,
    html: moldura(
      `<p style="margin:0 0 12px;font-size:19px;font-weight:600;">Pagamento confirmado</p>
<p style="margin:0;">Recebemos o pagamento da assinatura da <strong>${p.nomeEscola}</strong>.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0;width:100%;border:1px solid ${BORDA};border-radius:8px;">
  <tr><td style="padding:14px 16px;font-size:14px;color:${CINZA};">Valor</td>
      <td style="padding:14px 16px;font-size:15px;font-weight:600;text-align:right;">${dinheiro(p.valor)}</td></tr>
  ${p.proximoVencimento ? `<tr><td style="padding:0 16px 14px;font-size:14px;color:${CINZA};">Próxima cobrança</td><td style="padding:0 16px 14px;font-size:15px;text-align:right;">${dataBR(p.proximoVencimento)}</td></tr>` : ""}
</table>
<p style="margin:20px 0 0;font-size:13px;color:${CINZA};">Nada a fazer — o acesso segue normal.</p>`,
      previa,
    ),
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   4. Assinatura vencida, dentro da carência
   ───────────────────────────────────────────────────────────────────────── */

export function emailAssinaturaAtrasada(p: {
  para: string;
  nomeEscola: string;
  valor: number;
  vencimento: string;
  diasDeCarencia: number;
}): Email {
  const previa = `A assinatura venceu em ${dataBR(p.vencimento)}.`;
  return {
    para: p.para,
    assunto: `Assinatura em atraso — ${PLATFORM_NAME}`,
    texto: `A assinatura da ${p.nomeEscola} venceu em ${dataBR(p.vencimento)} e ainda consta em aberto.

Valor: ${dinheiro(p.valor)}

O acesso continua funcionando por ${p.diasDeCarencia} dias. Depois disso, ele é suspenso até o pagamento.

Se você já pagou nos últimos dias, ignore este aviso — a baixa pode levar algumas horas.`,
    html: moldura(
      `<p style="margin:0 0 12px;font-size:19px;font-weight:600;">Assinatura em atraso</p>
<p style="margin:0;">A assinatura da <strong>${p.nomeEscola}</strong> venceu em ${dataBR(p.vencimento)} e ainda consta em aberto.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0;width:100%;border:1px solid ${BORDA};border-radius:8px;">
  <tr><td style="padding:14px 16px;font-size:14px;color:${CINZA};">Valor</td>
      <td style="padding:14px 16px;font-size:15px;font-weight:600;text-align:right;">${dinheiro(p.valor)}</td></tr>
</table>
<p style="margin:20px 0 0;">O acesso continua funcionando por <strong>${p.diasDeCarencia} dias</strong>. Depois disso é suspenso até o pagamento.</p>
<p style="margin:16px 0 0;font-size:13px;color:${CINZA};">Se você já pagou nos últimos dias, ignore este aviso — a baixa pode levar algumas horas.</p>`,
      previa,
    ),
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   5. Acesso suspenso
   ───────────────────────────────────────────────────────────────────────── */

export function emailAssinaturaSuspensa(p: {
  para: string;
  nomeEscola: string;
  valor: number;
}): Email {
  const previa = "O acesso ao sistema foi suspenso.";
  return {
    para: p.para,
    assunto: `Acesso suspenso — ${PLATFORM_NAME}`,
    texto: `O acesso da ${p.nomeEscola} foi suspenso porque a assinatura segue em aberto além do prazo.

Valor: ${dinheiro(p.valor)}

Seus dados estão todos guardados. Assim que o pagamento for confirmado, o acesso volta sozinho.

Se precisar de prazo, é só responder este e-mail.`,
    html: moldura(
      `<p style="margin:0 0 12px;font-size:19px;font-weight:600;">Acesso suspenso</p>
<p style="margin:0;">O acesso da <strong>${p.nomeEscola}</strong> foi suspenso porque a assinatura segue em aberto além do prazo.</p>
<p style="margin:20px 0 0;"><strong>Seus dados estão todos guardados.</strong> Assim que o pagamento for confirmado, o acesso volta sozinho.</p>
<p style="margin:16px 0 0;font-size:13px;color:${CINZA};">Se precisar de prazo, é só responder este e-mail.</p>`,
      previa,
    ),
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   6. Conta de pagamentos — desfecho da análise
   ───────────────────────────────────────────────────────────────────────── */

export function emailContaPagamentos(p: {
  para: string;
  nomeEscola: string;
  aprovada: boolean;
  motivo?: string | null;
}): Email {
  if (p.aprovada) {
    return {
      para: p.para,
      assunto: `Conta de pagamentos aprovada — ${PLATFORM_NAME}`,
      texto: `A conta de pagamentos da ${p.nomeEscola} foi aprovada.

Já dá para cobrar as mensalidades pelo sistema. O dinheiro cai direto na conta da escola.

Comece em ${PLATFORM_URL}/financeiro`,
      html: moldura(
        `<p style="margin:0 0 12px;font-size:19px;font-weight:600;">Conta de pagamentos aprovada</p>
<p style="margin:0;">A conta da <strong>${p.nomeEscola}</strong> foi aprovada. Já dá para cobrar as mensalidades pelo sistema — e o dinheiro cai direto na conta da escola.</p>
${botao(`${PLATFORM_URL}/financeiro`, "Ir para o Financeiro")}`,
        "A conta de pagamentos foi aprovada.",
      ),
    };
  }

  /* Recusa carrega o motivo do provedor, literal. Sem ele a escola abre
     chamado com a gente, e a plataforma vira suporte do Asaas. */
  const motivo = p.motivo?.trim();
  return {
    para: p.para,
    assunto: `Conta de pagamentos recusada — ${PLATFORM_NAME}`,
    texto: `A conta de pagamentos da ${p.nomeEscola} foi recusada na análise.

${motivo ? `Motivo informado: ${motivo}` : "O provedor não detalhou o motivo."}

Veja o que fazer em ${PLATFORM_URL}/financeiro/conta-pagamentos — e, se precisar, é só responder este e-mail.`,
    html: moldura(
      `<p style="margin:0 0 12px;font-size:19px;font-weight:600;">Conta de pagamentos recusada</p>
<p style="margin:0;">A conta da <strong>${p.nomeEscola}</strong> foi recusada na análise.</p>
${motivo ? `<p style="margin:20px 0 0;padding:14px 16px;border:1px solid ${BORDA};border-radius:8px;font-size:14px;">${motivo}</p>` : `<p style="margin:20px 0 0;font-size:14px;color:${CINZA};">O provedor não detalhou o motivo.</p>`}
${botao(`${PLATFORM_URL}/financeiro/conta-pagamentos`, "Ver o que fazer")}
<p style="margin:20px 0 0;font-size:13px;color:${CINZA};">Se precisar de ajuda, é só responder este e-mail.</p>`,
      "A conta de pagamentos foi recusada.",
    ),
  };
}
