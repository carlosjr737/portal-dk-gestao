import "server-only";

import { createClient as createSbClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type PinaRole = "admin" | "equipe" | "professor";

export type PinaViewer = {
  profileId: string;
  email: string | null;
  role: PinaRole;
  /** id do professor no portal (staff_members.id), resolvido por e-mail; null se não for professor cadastrado. */
  staffMemberId: string | null;
};

/**
 * Valida um access token do Supabase (enviado pelo Pina em Authorization: Bearer)
 * e retorna o usuário. Retorna null se inválido.
 */
export async function getUserFromBearer(
  token: string | null,
): Promise<{ id: string; email: string | null } | null> {
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const supabase = createSbClient(url, anon);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Resolve papel e vínculo de professor (por E-MAIL) do usuário logado.
 * Vínculo: profiles.email = staff_members.email (case-insensitive).
 */
export async function resolvePinaViewer(
  userId: string,
): Promise<PinaViewer | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, role, active")
    .eq("id", userId)
    .maybeSingle();

  if (
    !profile ||
    profile.active === false ||
    !["admin", "equipe", "professor"].includes(profile.role as string)
  ) {
    return null;
  }

  let staffMemberId: string | null = null;
  if (profile.email) {
    const { data: staff } = await admin
      .from("staff_members")
      .select("id")
      .ilike("email", profile.email as string)
      .maybeSingle();
    staffMemberId = (staff?.id as string | undefined) ?? null;
  }

  return {
    profileId: profile.id as string,
    email: (profile.email as string | null) ?? null,
    role: profile.role as PinaRole,
    staffMemberId,
  };
}
