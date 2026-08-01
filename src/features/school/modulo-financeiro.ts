import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A escola cobra os alunos pelo sistema?
 *
 * Governa o que existe na interface: sem o módulo, não há como o sistema
 * saber quem pagou, então telas como Inadimplência não devem nem aparecer.
 * Melhor não oferecer do que oferecer vazia.
 *
 * `cache()` porque isto roda no layout, a cada navegação.
 */
export const escolaUsaModuloFinanceiro = cache(
  async (escolaId: string | null): Promise<boolean> => {
    if (!escolaId) return false;
    const admin = createAdminClient();
    const { data } = await admin
      .from("school")
      .select("usa_pagamentos")
      .eq("id", escolaId)
      .maybeSingle();
    return Boolean(data?.usa_pagamentos);
  },
);
