"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { enviarEmail } from "@/features/email/client";
import { renderizar } from "@/features/email/render";
import { PLATFORM_URL } from "@/lib/branding";

export type EstadoConvite = {
  ok?: boolean;
  erro?: string;
  enviados?: number;
  semEmail?: string[];
  falhas?: Array<{ nome: string; motivo: string }>;
};

/**
 * Avisa a equipe que o Pina está liberado.
 *
 * ┌─ DISPARO MANUAL, E ESTE É O ÚNICO DA CASA ──────────────────────────┐
 * │ Os outros seis e-mails saem sozinhos quando um evento acontece. Este │
 * │ não tem evento: liberar o Pina é uma decisão de gente, tomada num    │
 * │ dia escolhido, e amarrá-lo a um gatilho automático significaria      │
 * │ mandar convite no meio de uma quinta-feira qualquer só porque um     │
 * │ cadastro mudou.                                                      │
 * │                                                                     │
 * │ Como é manual, ele TAMBÉM não guarda "já enviei": quem decide        │
 * │ reenviar é quem clica. A trava contra repetição é a tela dizer       │
 * │ quantos foram, não o sistema recusar.                                │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * O texto sai do catálogo (`pina_liberado`), então a escola pode reescrevê-lo
 * na aba de Comunicação antes de disparar — que é justamente o que se quer
 * poder fazer antes de falar com a equipe inteira de uma vez.
 */
export async function enviarConvitePina(
  _anterior: EstadoConvite,
  formData: FormData,
): Promise<EstadoConvite> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    return { erro: "Você não tem permissão para enviar este convite." };
  }

  const escolaId = profile.escolaId ?? (await getCurrentEscolaId());
  if (!escolaId) return { erro: "Seu usuário não está vinculado a uma escola." };

  const ids = formData.getAll("staffId").map(String).filter(Boolean);
  if (ids.length === 0) return { erro: "Escolha pelo menos uma pessoa." };

  const admin = createAdminClient();
  const [{ data: equipe }, { data: escola }] = await Promise.all([
    admin
      .from("staff_members")
      .select("id, full_name, artistic_name, email")
      .eq("escola_id", escolaId)
      .in("id", ids),
    admin.from("school").select("nome").eq("id", escolaId).maybeSingle(),
  ]);

  const nomeEscola = (escola?.nome as string | null) ?? "sua escola";

  let enviados = 0;
  const semEmail: string[] = [];
  const falhas: Array<{ nome: string; motivo: string }> = [];

  for (const p of equipe ?? []) {
    const nome =
      ((p.artistic_name as string | null)?.trim() || (p.full_name as string | null)) ??
      "Professor";
    const email = (p.email as string | null)?.trim();

    /*
     * Sem e-mail não é falha de envio, é falha de cadastro — e por isso vem
     * numa lista à parte. Misturar as duas faria a escola procurar problema
     * no provedor quando o buraco está no cadastro dela.
     */
    if (!email) {
      semEmail.push(nome);
      continue;
    }

    const mensagem = await renderizar({
      chave: "pina_liberado",
      para: email,
      escolaId,
      valores: {
        escola: nomeEscola,
        pessoa: nome.split(" ")[0] ?? nome,
        link_acesso: `${PLATFORM_URL}/pina`,
      },
    });

    const envio = await enviarEmail(mensagem);
    if (envio.ok) enviados += 1;
    else falhas.push({ nome, motivo: envio.detalhe ?? envio.motivo });
  }

  return { ok: true, enviados, semEmail, falhas };
}
