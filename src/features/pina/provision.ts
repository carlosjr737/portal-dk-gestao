import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPinaFirebaseAuth } from "@/features/pina/firebase-admin";
import {
  PINA_APP_URL,
  PINA_AUTH_ACTION_URL,
  PINA_CONTINUE_URL,
} from "@/features/pina/config";

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
  espetaculoId?: string,
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
    // Gera o link padrão SÓ pra extrair o oobCode (sem actionCodeSettings ->
    // não exige domínio autorizado no Firebase).
    const rawLink = await auth.generatePasswordResetLink(email);
    const oob = new URL(rawLink).searchParams.get("oobCode");
    if (!oob) {
      console.error("Pina provision: oobCode ausente no link", rawLink);
      return { ok: false, error: "reset_link_error" };
    }
    // Com espetáculo -> abre direto nele; sem -> raiz do app (lista do professor).
    const continueUrl = espetaculoId
      ? `${PINA_APP_URL}/?espetaculoId=${encodeURIComponent(espetaculoId)}`
      : PINA_CONTINUE_URL;
    // Monta o link apontando pra PÁGINA DO PINA (branding + redirect próprios).
    resetLink =
      `${PINA_AUTH_ACTION_URL}?mode=resetPassword&oobCode=${encodeURIComponent(oob)}` +
      `&continueUrl=${encodeURIComponent(continueUrl)}`;
  } catch (err) {
    console.error("Pina provision reset link error:", err);
    return { ok: false, error: "reset_link_error" };
  }

  return { ok: true, email, resetLink, created };
}
