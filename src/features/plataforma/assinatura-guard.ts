import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformOwner } from "@/features/plataforma/auth";

/**
 * Dias de tolerância depois do vencimento antes de bloquear o acesso.
 *
 * Bloquear no dia seguinte ao vencimento puniria atraso de compensação
 * bancária, feriado ou fim de semana — o cliente pagou e mesmo assim ficaria
 * de fora. A carência dá margem para o pagamento chegar.
 */
const DIAS_DE_CARENCIA = 5;

export type SituacaoAssinatura = {
  /** Sem acesso ao portal: vencida além da carência. */
  bloqueada: boolean;
  /** Vencida, mas ainda dentro da carência — mostra aviso, não bloqueia. */
  emAviso: boolean;
  status: string | null;
  valor: number | null;
  vencimento: string | null;
  diasDeAtraso: number;
};

const LIVRE: SituacaoAssinatura = {
  bloqueada: false,
  emAviso: false,
  status: null,
  valor: null,
  vencimento: null,
  diasDeAtraso: 0,
};

function diasDesde(dataISO: string): number {
  const venc = new Date(`${dataISO}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.floor((hoje.getTime() - venc.getTime()) / 86_400_000);
}

/**
 * Situação da assinatura da escola, para decidir se o portal fica liberado.
 *
 * Regras deliberadas:
 *  - Escola SEM assinatura não é bloqueada. Bloquear trancaria toda escola
 *    que existe antes de ser cobrada — inclusive na migração.
 *  - Operador da plataforma nunca é bloqueado: é quem resolve o problema.
 */
export const getSituacaoAssinatura = cache(
  async (escolaId: string | null): Promise<SituacaoAssinatura> => {
    if (!escolaId) return LIVRE;
    if (await isPlatformOwner()) return LIVRE;

    const admin = createAdminClient();
    const { data } = await admin
      .from("plataforma_assinatura")
      .select("status, valor, proximo_vencimento")
      .eq("escola_id", escolaId)
      .maybeSingle();

    // Ainda não cobrada: acesso liberado.
    if (!data) return LIVRE;

    const status = data.status as string;
    const vencimento = (data.proximo_vencimento as string | null) ?? null;
    const valor = data.valor != null ? Number(data.valor) : null;

    // Cancelada bloqueia na hora — a relação comercial acabou.
    if (status === "cancelada") {
      return { bloqueada: true, emAviso: false, status, valor, vencimento, diasDeAtraso: 0 };
    }

    if (status === "ativa" || !vencimento) {
      return { ...LIVRE, status, valor, vencimento };
    }

    const atraso = diasDesde(vencimento);
    if (atraso <= 0) {
      return { ...LIVRE, status, valor, vencimento };
    }

    return {
      bloqueada: atraso > DIAS_DE_CARENCIA,
      emAviso: atraso <= DIAS_DE_CARENCIA,
      status,
      valor,
      vencimento,
      diasDeAtraso: atraso,
    };
  },
);

export { DIAS_DE_CARENCIA };
