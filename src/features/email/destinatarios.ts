import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Para quem mandar o aviso de uma escola.
 *
 * O e-mail de assinatura é assunto de dono, não de secretaria: quem precisa
 * saber que o acesso vai cair é quem paga. Por isso a busca é por `admin`, e
 * não por qualquer perfil ativo.
 *
 * `school.email` fica como segundo caminho porque é o e-mail institucional do
 * cadastro — serve quando o admin foi desativado e ninguém assumiu o lugar,
 * que é justamente quando a conta está sendo abandonada e o aviso mais
 * importa.
 *
 * Devolver `null` é resultado legítimo, não erro: escola sem e-mail nenhum
 * existe, e quem chamar precisa seguir sem avisar em vez de estourar.
 */
export type Destinatario = {
  email: string;
  nomeEscola: string;
};

export async function destinatarioDaEscola(
  escolaId: string,
): Promise<Destinatario | null> {
  const admin = createAdminClient();

  const [{ data: escola }, { data: admins }] = await Promise.all([
    admin.from("school").select("nome, email").eq("id", escolaId).maybeSingle(),
    admin
      .from("profiles")
      .select("email, created_at")
      .eq("escola_id", escolaId)
      .eq("role", "admin")
      .eq("active", true)
      // O mais antigo é quem abriu a conta — o dono, na prática.
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  const nomeEscola = (escola?.nome as string | null) ?? "sua escola";
  const doAdmin = (admins?.[0]?.email as string | null)?.trim();
  const daEscola = (escola?.email as string | null)?.trim();

  const email = doAdmin || daEscola;
  if (!email) {
    console.warn("[email] escola sem destinatário", { escolaId });
    return null;
  }

  return { email, nomeEscola };
}
