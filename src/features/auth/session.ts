import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isUserRole,
  type UserProfile,
} from "@/features/auth/permissions";

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  active: boolean | null;
  escola_id: string | null;
};

/**
 * `cache()` memoriza o resultado DENTRO de um mesmo request.
 *
 * Sem isso, cada componente de servidor que precisa do usuário faz uma chamada
 * à API de autenticação do Supabase — uma página só dispara várias, e sob
 * carga isso estoura o rate limit (429 over_request_rate_limit).
 * Com o cache, é uma chamada por request, independente de quantos componentes
 * peçam. Entre requests nada é reaproveitado, então a sessão continua fresca.
 */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

export const getProfileByUserId = cache(async function getProfileByUserId(
  userId: string,
): Promise<UserProfile | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, active, escola_id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("Auth profile load error:", error.message);
    }

    return null;
  }

  return normalizeProfile(data as ProfileRow);
});

function normalizeProfile(profile: ProfileRow): UserProfile | null {
  if (!isUserRole(profile.role)) {
    return null;
  }

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    active: profile.active === true,
    escolaId: profile.escola_id,
  };
}

/**
 * Escola (tenant) do usuário logado. Toda query/insert de dados de domínio
 * deve ser escopada por este id — é o equivalente, no código, ao
 * `current_escola()` que as policies de RLS usam no banco.
 *
 * Retorna null se não houver sessão ou se o perfil ainda não tiver escola.
 */
export async function getCurrentEscolaId(): Promise<string | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const profile = await getProfileByUserId(user.id);
  return profile?.escolaId ?? null;
}
