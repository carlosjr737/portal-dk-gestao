"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import {
  CATALOGO,
  definicao,
  faltandoObrigatorias,
  type ChaveTemplate,
} from "@/features/email/catalogo";
import { renderizar, textoEmVigor } from "@/features/email/render";
import { enviarEmail } from "@/features/email/client";
import { sanearHtml } from "@/features/comunicacao/sanear";

/**
 * Edição dos textos automáticos.
 *
 * SÓ ADMIN. Estes textos saem em nome da escola para a equipe dela — quem
 * pode reescrever a comunicação oficial é quem responde por ela.
 */
async function exigirAdmin(): Promise<
  { ok: true; escolaId: string; userId: string; email: string } | { ok: false; erro: string }
> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { ok: false, erro: "Apenas admin edita os textos." };
  }
  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { ok: false, erro: "Seu usuário não está vinculado a uma escola." };
  return { ok: true, escolaId, userId: user!.id, email: profile.email ?? "" };
}

export type EstadoSalvar = {
  ok?: boolean;
  erro?: string;
  /** Obrigatórias que faltaram, com o porquê escrito por extenso. */
  faltando?: Array<{ nome: string; porque: string }>;
};

export async function salvarTemplate(
  _anterior: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const auth = await exigirAdmin();
  if (!auth.ok) return { erro: auth.erro };

  const chave = String(formData.get("chave") ?? "") as ChaveTemplate;
  const assunto = String(formData.get("assunto") ?? "").trim();
  const corpo = sanearHtml(String(formData.get("corpo") ?? "").trim());

  if (!CATALOGO.some((t) => t.chave === chave)) return { erro: "Texto desconhecido." };
  if (!assunto) return { erro: "O assunto não pode ficar vazio." };
  if (!corpo) return { erro: "A mensagem não pode ficar vazia." };

  /*
   * A VALIDAÇÃO RODA AQUI, não só na tela. O navegador é conveniência; esta
   * é a que vale. Sem ela, bastaria desligar o JavaScript para salvar um
   * e-mail de acesso sem o link de acesso.
   */
  const faltando = faltandoObrigatorias(chave, assunto, corpo);
  if (faltando.length > 0) {
    return { faltando: faltando.map((f) => ({ nome: f.nome, porque: f.porque })) };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("email_template").upsert(
    {
      escola_id: auth.escolaId,
      chave,
      assunto,
      corpo,
      atualizado_por: auth.userId,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "escola_id,chave" },
  );

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  // Rastro. Falha aqui não desfaz o salvamento — perder o histórico é ruim,
  // perder a edição do usuário é pior.
  await admin.from("email_template_historico").insert({
    escola_id: auth.escolaId,
    chave,
    assunto,
    corpo,
    acao: "salvou",
    autor_id: auth.userId,
    autor_email: auth.email,
  });

  revalidatePath("/configuracoes/comunicacao");
  return { ok: true };
}

/**
 * Volta ao texto padrão — que é apagar a linha, não regravar o padrão.
 *
 * Regravar exigiria que o padrão do código e o gravado ficassem iguais para
 * sempre; no dia em que alguém melhorasse a redação padrão, a escola
 * "restaurada" continuaria com a versão velha, sem saber.
 */
export async function restaurarTemplate(chave: ChaveTemplate): Promise<EstadoSalvar> {
  const auth = await exigirAdmin();
  if (!auth.ok) return { erro: auth.erro };

  const admin = createAdminClient();
  const atual = await textoEmVigor(chave, auth.escolaId);

  const { error } = await admin
    .from("email_template")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("chave", chave);

  if (error) return { erro: `Não foi possível restaurar: ${error.message}` };

  if (atual.personalizado) {
    await admin.from("email_template_historico").insert({
      escola_id: auth.escolaId,
      chave,
      assunto: atual.assunto,
      corpo: atual.corpo,
      acao: "restaurou",
      autor_id: auth.userId,
      autor_email: auth.email,
    });
  }

  revalidatePath("/configuracoes/comunicacao");
  return { ok: true };
}

export type EstadoTeste = { ok?: boolean; erro?: string; enviadoPara?: string };

/**
 * Manda o texto que está na tela para quem está editando.
 *
 * USA O RASCUNHO, não o gravado: testar só depois de salvar obrigaria a
 * publicar para conferir, que é a ordem errada quando o texto sai
 * automaticamente para a equipe inteira.
 */
export async function enviarTeste(
  _anterior: EstadoTeste,
  formData: FormData,
): Promise<EstadoTeste> {
  const auth = await exigirAdmin();
  if (!auth.ok) return { erro: auth.erro };
  if (!auth.email) return { erro: "Seu usuário não tem e-mail cadastrado." };

  const chave = String(formData.get("chave") ?? "") as ChaveTemplate;
  if (!CATALOGO.some((t) => t.chave === chave)) return { erro: "Texto desconhecido." };

  const d = definicao(chave);
  const valores = Object.fromEntries(d.variaveis.map((v) => [v.nome, v.exemplo]));

  const email = await renderizar({
    chave,
    para: auth.email,
    escolaId: auth.escolaId,
    valores,
    rascunho: {
      assunto: String(formData.get("assunto") ?? ""),
      corpo: sanearHtml(String(formData.get("corpo") ?? "")),
    },
  });

  const envio = await enviarEmail({ ...email, assunto: `[teste] ${email.assunto}` });
  if (!envio.ok) {
    return {
      erro:
        envio.motivo === "nao_configurado"
          ? "O envio de e-mail ainda não está configurado no servidor."
          : `O provedor recusou: ${envio.detalhe ?? "motivo não informado"}`,
    };
  }
  return { ok: true, enviadoPara: envio.destino };
}
