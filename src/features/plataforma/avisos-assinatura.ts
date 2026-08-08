import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { DIAS_DE_CARENCIA } from "@/features/plataforma/assinatura-guard";
import { enviarEmail } from "@/features/email/client";
import { destinatarioDaEscola } from "@/features/email/destinatarios";
import {
  emailAssinaturaAtrasada,
  emailAssinaturaConfirmada,
  emailAssinaturaSuspensa,
} from "@/features/email/templates";

/**
 * Avisos da assinatura da plataforma.
 *
 * ┌─ POR QUE ISTO NÃO PODE SER SÓ WEBHOOK ──────────────────────────────┐
 * │ A SUSPENSÃO NÃO É UM EVENTO. Ninguém grava "suspensa" no banco:     │
 * │ `getSituacaoAssinatura` compara o vencimento com hoje toda vez que  │
 * │ alguém abre o portal. Ou seja, a escola é bloqueada no sexto dia    │
 * │ pela passagem do tempo — e tempo não dispara webhook. Sem uma       │
 * │ varredura diária, a escola descobre que perdeu o acesso ao tentar   │
 * │ entrar, sem nunca ter recebido um aviso.                            │
 * │                                                                     │
 * │ E tem o caso sem provedor nenhum: escola cobrada por fora não tem   │
 * │ assinatura no Asaas, logo não tem webhook nenhum. Para ela, esta    │
 * │ varredura é o ÚNICO caminho de aviso.                               │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * UMA FUNÇÃO SÓ, DOIS GATILHOS. O webhook chama para reagir na hora; o cron
 * chama todo dia para pegar o que o relógio mudou. Como os dois passam pela
 * mesma comparação com `ultimo_aviso`, quem chegar primeiro avisa e o outro
 * fica quieto — em vez de a escola receber o mesmo e-mail duas vezes.
 */

export type EtapaAviso = "confirmada" | "atrasada" | "suspensa";

function diasDesde(dataISO: string): number {
  const venc = new Date(`${dataISO}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.floor((hoje.getTime() - venc.getTime()) / 86_400_000);
}

/**
 * Em que ponto da régua a assinatura está — o mesmo corte que decide o acesso.
 *
 * Recebe o último aviso porque "em dia" só vira e-mail quando houve susto
 * antes: mandar "pagamento confirmado" para quem nunca atrasou seria avisar
 * a escola, todo mês, de que nada aconteceu. Com `ultimoAviso` nulo, quem
 * está em dia não recebe nada — inclusive na primeira varredura, que de outro
 * modo mandaria "confirmada" para a base inteira de uma vez.
 *
 * `cancelada` fica de fora de propósito: cancelamento é conversa comercial,
 * com motivo e com gente dos dois lados. E-mail automático dizendo "seu acesso
 * acabou" seria a pior forma possível de encerrar uma relação.
 */
export function etapaDaAssinatura(p: {
  status: string;
  vencimento: string | null;
  ultimoAviso: EtapaAviso | null;
}): EtapaAviso | null {
  if (p.status === "cancelada") return null;

  const voltouAoNormal = p.ultimoAviso ? "confirmada" : null;

  if (p.status === "ativa" || !p.vencimento) return voltouAoNormal;

  const atraso = diasDesde(p.vencimento);
  if (atraso <= 0) return voltouAoNormal;
  if (atraso <= DIAS_DE_CARENCIA) return "atrasada";
  return "suspensa";
}

export type ResultadoAviso =
  | { enviado: false; motivo: "sem_assinatura" | "sem_mudanca" | "sem_destinatario" | "falha" }
  | { enviado: true; etapa: EtapaAviso };

/**
 * Manda o aviso que falta para uma escola — se é que falta algum.
 *
 * `ultimo_aviso` SÓ É GRAVADO QUANDO O E-MAIL SAIU DE VERDADE. Gravar antes
 * pareceria mais simples, mas apagaria a dívida sem pagá-la: sem
 * `RESEND_API_KEY` o envio devolve `nao_configurado` sem mandar nada, e a
 * escola que estava para ser avisada nunca mais entraria na conta. Não
 * gravando, a varredura de amanhã tenta de novo — e no dia em que a chave
 * existir, o aviso atrasado sai.
 */
export async function sincronizarAvisoDeAssinatura(
  escolaId: string,
): Promise<ResultadoAviso> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("plataforma_assinatura")
    .select("status, valor, proximo_vencimento, ultimo_aviso")
    .eq("escola_id", escolaId)
    .maybeSingle();

  /*
   * Erro aqui é quase sempre a coluna `ultimo_aviso` faltando — o script
   * `avisos_01_coluna.sql` não foi rodado. Sem esta linha, o PostgREST
   * devolve `data: null` e o caso viraria "escola sem assinatura": a
   * varredura passaria dizendo que não havia nada a fazer, todo dia, e
   * ninguém receberia aviso nenhum sem que nada parecesse errado.
   */
  if (error) {
    console.error("[avisos] leitura da assinatura falhou", { escolaId, erro: error.message });
    return { enviado: false, motivo: "falha" };
  }

  if (!data) return { enviado: false, motivo: "sem_assinatura" };

  const ultimoAviso = (data.ultimo_aviso as EtapaAviso | null) ?? null;
  const vencimento = (data.proximo_vencimento as string | null) ?? null;
  const valor = Number(data.valor ?? 0);

  const etapa = etapaDaAssinatura({
    status: data.status as string,
    vencimento,
    ultimoAviso,
  });

  if (etapa === null || etapa === ultimoAviso) {
    return { enviado: false, motivo: "sem_mudanca" };
  }

  const destinatario = await destinatarioDaEscola(escolaId);
  if (!destinatario) return { enviado: false, motivo: "sem_destinatario" };

  const comum = { para: destinatario.email, nomeEscola: destinatario.nomeEscola, valor };

  const email =
    etapa === "confirmada"
      ? emailAssinaturaConfirmada({ ...comum, proximoVencimento: vencimento })
      : etapa === "atrasada"
        ? emailAssinaturaAtrasada({
            ...comum,
            // `atrasada` só é alcançável com vencimento; o `??` é para o tipo.
            vencimento: vencimento ?? "",
            diasDeCarencia: DIAS_DE_CARENCIA,
          })
        : emailAssinaturaSuspensa(comum);

  const envio = await enviarEmail(email);
  if (!envio.ok) return { enviado: false, motivo: "falha" };

  await admin
    .from("plataforma_assinatura")
    .update({ ultimo_aviso: etapa, updated_at: new Date().toISOString() })
    .eq("escola_id", escolaId);

  return { enviado: true, etapa };
}

export type RelatorioVarredura = {
  analisadas: number;
  enviados: number;
  porEtapa: Record<string, number>;
  semDestinatario: number;
  falhas: number;
};

/**
 * Varredura diária de todas as escolas.
 *
 * Roda em série, não em paralelo: são poucas escolas, cada uma é um POST ao
 * provedor de e-mail, e disparar tudo de uma vez só serviria para bater no
 * limite de taxa dele.
 */
export async function varrerAvisosDeAssinatura(): Promise<RelatorioVarredura> {
  const admin = createAdminClient();

  const { data: assinaturas } = await admin
    .from("plataforma_assinatura")
    .select("escola_id")
    // Cancelada nunca gera aviso; filtrar aqui evita uma consulta por escola.
    .neq("status", "cancelada");

  const relatorio: RelatorioVarredura = {
    analisadas: assinaturas?.length ?? 0,
    enviados: 0,
    porEtapa: {},
    semDestinatario: 0,
    falhas: 0,
  };

  for (const a of assinaturas ?? []) {
    try {
      const r = await sincronizarAvisoDeAssinatura(a.escola_id as string);
      if (r.enviado) {
        relatorio.enviados += 1;
        relatorio.porEtapa[r.etapa] = (relatorio.porEtapa[r.etapa] ?? 0) + 1;
      } else if (r.motivo === "sem_destinatario") {
        relatorio.semDestinatario += 1;
      } else if (r.motivo === "falha") {
        relatorio.falhas += 1;
      }
    } catch (e) {
      // Uma escola com problema não pode interromper a varredura das outras.
      relatorio.falhas += 1;
      console.error("[avisos] falha em escola", { escolaId: a.escola_id, erro: e });
    }
  }

  return relatorio;
}
