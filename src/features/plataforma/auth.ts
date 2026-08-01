import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/features/auth/session";

/**
 * Operador da plataforma — quem enxerga TODAS as escolas para cobrar
 * assinatura, cadastrar escola e suspender inadimplente.
 *
 * É um conceito à parte dos papéis do portal (admin/equipe/professor), que
 * são sempre relativos a UMA escola.
 */
export const isPlatformOwner = cache(async (): Promise<boolean> => {
  const user = await getAuthenticatedUser();
  if (!user) return false;

  // admin client: a checagem não pode depender da RLS que ela própria habilita.
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_owner")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return Boolean(data);
});
