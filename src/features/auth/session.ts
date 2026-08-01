import "server-only";

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

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getProfileByUserId(userId: string): Promise<UserProfile | null> {
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
}

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
