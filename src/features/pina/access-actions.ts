"use server";

import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";
import { getStaffDisplayName } from "@/features/staff/formatters";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  provisionPinaProfessor,
  type ProvisionResult,
} from "@/features/pina/provision";

async function isAdmin(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  return Boolean(profile && ["admin", "equipe"].includes(profile.role));
}

export type ProvisionOneState =
  | { status: "idle" }
  | { status: "ok"; email: string; resetLink: string; created: boolean }
  | { status: "error"; error: string };

/** Provisiona (cria/atualiza) a conta Firebase de um professor e gera o link de senha. */
export async function provisionPinaAction(
  staffMemberId: string,
): Promise<ProvisionOneState> {
  if (!(await isAdmin())) return { status: "error", error: "forbidden" };
  const r: ProvisionResult = await provisionPinaProfessor(staffMemberId);
  if (!r.ok) return { status: "error", error: r.error };
  return { status: "ok", email: r.email, resetLink: r.resetLink, created: r.created };
}

export type BackfillRow = {
  nome: string;
  email: string | null;
  status: "ok" | "error";
  detail: string;
};

/** Backfill: provisiona todos os professores com e-mail. */
export async function provisionAllPinaAction(): Promise<{
  ok: boolean;
  rows?: BackfillRow[];
  error?: string;
}> {
  if (!(await isAdmin())) return { ok: false, error: "forbidden" };
  const admin = createAdminClient();
  const { data: profs } = await admin
    .from("staff_members")
    .select("id, full_name, artistic_name, email")
    .eq("role", "professor")
    .order("full_name");

  const rows: BackfillRow[] = [];
  for (const p of profs ?? []) {
    const nome = getStaffDisplayName(p);
    const email = (p.email as string | null) ?? null;
    const r = await provisionPinaProfessor(p.id as string);
    rows.push({
      nome,
      email,
      status: r.ok ? "ok" : "error",
      detail: r.ok ? (r.created ? "conta criada" : "conta atualizada") : r.error,
    });
  }
  return { ok: true, rows };
}
