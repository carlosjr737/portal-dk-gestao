import "server-only";

/**
 * Envio de e-mail.
 *
 * TRÊS TRAVAS, NESTA ORDEM, E TODAS DE PROPÓSITO:
 *
 * 1. SEM CHAVE, NÃO ENVIA. `RESEND_API_KEY` ausente faz a função registrar no
 *    log e devolver `nao_configurado`. É o que torna este código seguro de
 *    subir antes de o domínio estar verificado: o deploy não manda nada para
 *    ninguém enquanto a chave não existir.
 *
 * 2. `EMAIL_REDIRECT_TO` desvia TUDO para um endereço só. Com ela ligada,
 *    nenhum e-mail chega a uma escola de verdade — o assunto ganha o
 *    destinatário original na frente, para dar para conferir o que teria ido
 *    para quem. É assim que se testa mensagem de cobrança sem constranger
 *    cliente.
 *
 * 3. Falha de envio NUNCA derruba a operação que a disparou. Pagamento
 *    confirmado que não conseguiu mandar recibo continua sendo pagamento
 *    confirmado; webhook que devolve erro porque o e-mail caiu faz o provedor
 *    reenviar o evento inteiro, e aí o status é reprocessado à toa.
 *
 * SEM SDK. A API do Resend é um POST com JSON; um pacote a mais para isso
 * seria dependência para economizar dez linhas. Trocar de provedor é reescrever
 * só esta função.
 */

export type ResultadoEnvio =
  | { ok: true; id: string }
  | { ok: false; motivo: "nao_configurado" | "erro"; detalhe?: string };

const REMETENTE_PADRAO = "SouAle <contato@souale.com.br>";

export type Email = {
  para: string;
  assunto: string;
  html: string;
  /** Alternativa em texto. Cliente que bloqueia HTML ainda lê a mensagem. */
  texto: string;
  /** Para onde a resposta vai, quando diferente do remetente. */
  responderPara?: string;
};

export async function enviarEmail(email: Email): Promise<ResultadoEnvio> {
  const chave = process.env.RESEND_API_KEY?.trim();
  const remetente = process.env.EMAIL_REMETENTE?.trim() || REMETENTE_PADRAO;
  const desvio = process.env.EMAIL_REDIRECT_TO?.trim();

  if (!chave) {
    console.info("[email] sem RESEND_API_KEY — não enviado", {
      para: email.para,
      assunto: email.assunto,
    });
    return { ok: false, motivo: "nao_configurado" };
  }

  const destino = desvio || email.para;
  const assunto = desvio ? `[teste → ${email.para}] ${email.assunto}` : email.assunto;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remetente,
        to: [destino],
        subject: assunto,
        html: email.html,
        text: email.texto,
        ...(email.responderPara ? { reply_to: email.responderPara } : {}),
      }),
    });

    const dados = (await res.json().catch(() => null)) as
      | { id?: string; message?: string }
      | null;

    if (!res.ok) {
      console.error("[email] provedor recusou", {
        status: res.status,
        detalhe: dados?.message,
        assunto: email.assunto,
      });
      return { ok: false, motivo: "erro", detalhe: dados?.message ?? `HTTP ${res.status}` };
    }

    return { ok: true, id: dados?.id ?? "" };
  } catch (e) {
    console.error("[email] falha de rede", e);
    return {
      ok: false,
      motivo: "erro",
      detalhe: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Dispara sem esperar e sem deixar estourar.
 *
 * Para usar dentro de webhook e de server action: a operação principal segue
 * o seu caminho, e o e-mail vira efeito colateral que falha sozinho.
 */
export function enviarEmailSemBloquear(email: Email): void {
  void enviarEmail(email).catch((e) => {
    console.error("[email] falhou em segundo plano", e);
  });
}
