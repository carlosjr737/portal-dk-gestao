import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERMISSOES_PADRAO, type UserRole } from "@/features/auth/permissions";

/**
 * As permissões em vigor numa escola.
 *
 * ┌─ POR PAPEL, NÃO POR LINHA ──────────────────────────────────────────┐
 * │ Existindo QUALQUER linha para um papel, aquela lista é a verdade    │
 * │ completa dele. Sem nenhuma linha, vale o padrão do código.          │
 * │                                                                     │
 * │ A alternativa — "linha ausente = padrão", como nos textos de e-mail │
 * │ — não serve aqui e a diferença é de consequência: texto padrão que  │
 * │ reaparece é um incômodo; TELA que reaparece é vazamento. A escola   │
 * │ tira o Financeiro do aux adm e ele volta sozinho na próxima leitura.│
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * `cache()` memoriza dentro do mesmo request: o layout pergunta uma vez e a
 * barra lateral reaproveita, em vez de duas idas ao banco por página.
 *
 * FALHA DE LEITURA CAI NO PADRÃO, e essa escolha merece ser explícita: o
 * padrão é mais restritivo que "admin", então uma indisponibilidade do banco
 * não abre nada — no máximo devolve alguém à configuração de fábrica, que
 * ainda protege o Financeiro e as Configurações.
 */
export const permissoesDaEscola = cache(
  async (escolaId: string | null): Promise<Record<UserRole, string[]>> => {
    if (!escolaId) return PERMISSOES_PADRAO;

    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("permissao_tela")
        .select("papel, href")
        .eq("escola_id", escolaId);

      if (error) {
        console.error("[permissoes] leitura falhou, usando padrão", {
          escolaId,
          erro: error.message,
        });
        return PERMISSOES_PADRAO;
      }

      const porPapel = new Map<string, string[]>();
      for (const linha of data ?? []) {
        const papel = linha.papel as string;
        porPapel.set(papel, [...(porPapel.get(papel) ?? []), linha.href as string]);
      }

      return {
        // A direção nunca vem do banco. Ver PERMISSOES_PADRAO.
        admin: PERMISSOES_PADRAO.admin,
        equipe: porPapel.get("equipe") ?? PERMISSOES_PADRAO.equipe,
        professor: porPapel.get("professor") ?? PERMISSOES_PADRAO.professor,
      };
    } catch (e) {
      console.error("[permissoes] indisponível, usando padrão", { escolaId, erro: e });
      return PERMISSOES_PADRAO;
    }
  },
);

/** Se a escola já configurou este papel, ou ainda está no padrão. */
export async function papelConfigurado(
  escolaId: string | null,
  papel: "equipe" | "professor",
): Promise<boolean> {
  if (!escolaId) return false;
  const admin = createAdminClient();
  const { count } = await admin
    .from("permissao_tela")
    .select("href", { count: "exact", head: true })
    .eq("escola_id", escolaId)
    .eq("papel", papel);
  return (count ?? 0) > 0;
}
