import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPinaFirebaseAuth } from "@/features/pina/firebase-admin";
import { PINA_LOGIN_URL } from "@/features/pina/config";

export type ProvisionResult =
  | { ok: true; email: string; resetLink: string; created: boolean }
  | { ok: false; error: string };

/**
 * Cria/atualiza a conta Firebase do professor para login direto no Pina.
 * - uid = staff_members.id (mesmo do SSO, pra os dados baterem).
 * - grava as claims NA CONTA (valem no login direto).
 * - gera o link de definição de senha (o envio é responsabilidade do chamador).
 */
export async function provisionPinaProfessor(
  staffMemberId: string,
): Promise<ProvisionResult> {
  const auth = getPinaFirebaseAuth();
  if (!auth) return { ok: false, error: "firebase_not_configured" };

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff_members")
    .select("id, email, role")
    .eq("id", staffMemberId)
    .maybeSingle();

  if (!staff) return { ok: false, error: "staff_not_found" };
  const email = (staff.email as string | null)?.trim();
  if (!email) return { ok: false, error: "sem_email" };

  // papel: se o e-mail bate com um profile admin/equipe -> master; senão professor.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .ilike("email", email)
    .maybeSingle();
  const role =
    profile && ["admin", "equipe"].includes(profile.role as string)
      ? "master"
      : "professor";

  const uid = staffMemberId;
  const claims = { role, professorId: staffMemberId, escolaId: null };

  // upsert do usuário Firebase
  let created = false;
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/user-not-found") {
      await auth.createUser({ uid, email });
      created = true;
    } else if (code === "auth/email-already-exists") {
      // e-mail já usado por OUTRO uid — não dá pra vincular a este staff.
      return { ok: false, error: "email_em_outra_conta" };
    } else {
      console.error("Pina provision get/update error:", err);
      return { ok: false, error: "firebase_error" };
    }
  }

  await auth.setCustomUserClaims(uid, claims);

  let resetLink: string;
  try {
    // continueUrl: volta pro login do Pina depois de definir a senha.
    resetLink = await auth.generatePasswordResetLink(email, {
      url: PINA_LOGIN_URL,
      handleCodeInApp: false,
    });
  } catch (err) {
    console.error("Pina provision reset link error:", err);
    return { ok: false, error: "reset_link_error" };
  }

  return { ok: true, email, resetLink, created };
}
