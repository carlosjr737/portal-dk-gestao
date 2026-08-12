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
  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff_members")
    .select("id, email, escola_id")
    .eq("id", staffMemberId)
    .maybeSingle();

  if (!staff) return { ok: false, error: "staff_not_found" };

  return provisionPinaConta(
    {
      uid: staffMemberId,
      email: (staff.email as string | null) ?? null,
      escolaId: (staff.escola_id as string | null) ?? null,
      staffMemberId,
    },
    espetaculoId,
  );
}

/**
 * O núcleo: cria/atualiza a conta no Firebase e devolve o link de senha.
 *
 * ┌─ POR QUE ISTO EXISTE SEPARADO ──────────────────────────────────────┐
 * │ A versão anterior só sabia provisionar quem tinha ficha em          │
 * │ `staff_members`. Mas o sistema tem DOIS cadastros — `profiles` (quem │
 * │ entra no portal) e `staff_members` (quem dá aula) — e adicionar em   │
 * │ um não cria no outro. Quem foi cadastrado só como usuário ficava     │
 * │ invisível para o Pina, sem erro nenhum: a lista simplesmente não o   │
 * │ continha.                                                            │
 * │                                                                     │
 * │ O UID CONTINUA SENDO O DO PROFESSOR QUANDO ELE EXISTE. É o que faz  │
 * │ os dados do Pina baterem com as turmas daqui; para quem só tem       │
 * │ perfil, o uid é o do perfil — mesma regra que o SSO já usava.        │
 * └─────────────────────────────────────────────────────────────────────┘
 */
export async function provisionPinaConta(
  pessoa: {
    uid: string;
    email: string | null;
    escolaId: string | null;
    /** null quando a pessoa não tem ficha de professor. */
    staffMemberId: string | null;
  },
  espetaculoId?: string,
): Promise<ProvisionResult> {
  const auth = getPinaFirebaseAuth();
  if (!auth) return { ok: false, error: "firebase_not_configured" };

  const admin = createAdminClient();
  const email = pessoa.email?.trim();
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

  /*
   * Aux adm vê tudo e não edita nada — a mesma regra do SSO, gravada NA CONTA
   * porque quem entra pelo login direto não passa pelo token do portal.
   *
   * Só "equipe": a direção continua podendo mexer. E a claim é adicional a
   * role="master" de propósito — ver o comentário no /api/pina/sso-token.
   */
  const somenteLeitura = (profile?.role as string | undefined) === "equipe";

  const uid = pessoa.uid;
  const staffMemberId = pessoa.staffMemberId;
  const staff = { escola_id: pessoa.escolaId };
  // escolaId vai na claim: é o que permite a API do Pina barrar acesso a
  // espetáculo de outra escola (o admin client de lá ignora a RLS).
  const claims = {
    role,
    professorId: staffMemberId,
    escolaId: (staff.escola_id as string | null) ?? null,
    somenteLeitura,
  };

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
