"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { navigationItems } from "@/features/auth/permissions";

export type EstadoPermissoes = { ok?: boolean; erro?: string };

const PAPEIS_EDITAVEIS = ["equipe", "professor"] as const;
type PapelEditavel = (typeof PAPEIS_EDITAVEIS)[number];

/**
 * SÓ A DIREÇÃO EDITA PERMISSÃO. Não é preferência: quem pode alterar o que os
 * outros veem decide, na prática, o próprio alcance — deixar isso com o aux
 * adm equivale a dar acesso total a ele, só que por um caminho torto.
 */
async function exigirDirecao(): Promise<
  { ok: true; escolaId: string } | { ok: false; erro: string }
> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { ok: false, erro: "Só a Direção edita permissões." };
  }
  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { ok: false, erro: "Seu usuário não está vinculado a uma escola." };
  return { ok: true, escolaId };
}

export async function salvarPermissoes(
  _anterior: EstadoPermissoes,
  formData: FormData,
): Promise<EstadoPermissoes> {
  const auth = await exigirDirecao();
  if (!auth.ok) return { erro: auth.erro };

  const papel = String(formData.get("papel") ?? "") as PapelEditavel;
  if (!PAPEIS_EDITAVEIS.includes(papel)) {
    return { erro: "Papel inválido. A Direção tem acesso total e não é editável." };
  }

  /*
   * Só entra href que existe no menu. Sem esta peneira, um campo forjado
   * gravaria "/" e transformaria o papel em admin por uma porta lateral.
   */
  const conhecidos = new Set<string>(navigationItems.map((i) => i.href));
  const escolhidos = formData
    .getAll("href")
    .map(String)
    .filter((h) => conhecidos.has(h));

  /*
   * Edição só vale para tela que a pessoa VÊ. Sem este cruzamento, marcar
   * "pode editar" e depois desmarcar a tela deixaria uma linha dizendo que
   * alguém edita algo que não enxerga — verdade nenhuma, e confusa de ler
   * depois.
   */
  const editaveis = new Set(
    formData.getAll("editar").map(String).filter((h) => escolhidos.includes(h)),
  );

  const admin = createAdminClient();

  /*
   * APAGA E REGRAVA, dentro do mesmo salvamento.
   *
   * A lista gravada é a verdade completa do papel — não um conjunto de
   * exceções. Fazer diferença (inserir o que entrou, apagar o que saiu)
   * daria o mesmo resultado com mais chance de sobrar linha órfã, e é
   * justamente a sobra que reabriria uma tela que a escola fechou.
   */
  const { error: erroDelete } = await admin
    .from("permissao_tela")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("papel", papel);

  if (erroDelete) return { erro: `Não foi possível salvar: ${erroDelete.message}` };

  if (escolhidos.length > 0) {
    const { error } = await admin.from("permissao_tela").insert(
      escolhidos.map((href) => ({
        escola_id: auth.escolaId,
        papel,
        href,
        pode_editar: editaveis.has(href),
      })),
    );
    if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  }

  /*
   * NENHUMA TELA MARCADA é gravado como tal, e não como "volta ao padrão".
   * Ambas as leituras são defensáveis; esta é a que não surpreende — quem
   * desmarca tudo espera bloquear tudo, não restaurar a fábrica.
   *
   * Para voltar ao padrão existe o botão de restaurar, que é explícito.
   */
  revalidatePath("/configuracoes/permissoes", "layout");
  return { ok: true };
}

/** Volta o papel ao padrão de fábrica — que é não ter linha nenhuma. */
export async function restaurarPermissoes(papel: string): Promise<EstadoPermissoes> {
  const auth = await exigirDirecao();
  if (!auth.ok) return { erro: auth.erro };
  if (!PAPEIS_EDITAVEIS.includes(papel as PapelEditavel)) {
    return { erro: "Papel inválido." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("permissao_tela")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("papel", papel);

  if (error) return { erro: `Não foi possível restaurar: ${error.message}` };

  revalidatePath("/configuracoes/permissoes", "layout");
  return { ok: true };
}
