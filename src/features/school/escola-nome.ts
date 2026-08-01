import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Nome da escola do usuário logado.
 *
 * A interface é multiescola: quem entra quer ver o nome da própria escola
 * na barra lateral, não o nome de quem construiu o sistema.
 *
 * `cache()` porque isto roda no layout, a cada navegação — mesmo motivo de
 * `escolaUsaModuloFinanceiro`.
 */
export const getEscolaNome = cache(
  async (escolaId: string | null): Promise<string | null> => {
    if (!escolaId) return null;

    const admin = createAdminClient();
    const { data } = await admin
      .from("school")
      .select("nome")
      .eq("id", escolaId)
      .maybeSingle();

    const nome = (data?.nome as string | null)?.trim();
    return nome || null;
  },
);
