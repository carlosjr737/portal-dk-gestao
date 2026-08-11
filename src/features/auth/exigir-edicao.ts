import "server-only";

import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { podeEditar } from "@/features/auth/permissions";
import { edicaoDaEscola, permissoesDaEscola } from "@/features/auth/permissoes-escola";

/**
 * Recusa a escrita de quem só pode ler.
 *
 * ┌─ A TRAVA É AQUI, NÃO NO BOTÃO ──────────────────────────────────────┐
 * │ Esconder o botão de salvar deixa o formulário inteiro de pé: o      │
 * │ endereço da action continua existindo, e um POST montado à mão      │
 * │ grava do mesmo jeito. Botão escondido é conforto visual; isto é a   │
 * │ permissão.                                                          │
 * │                                                                     │
 * │ ESTOURA em vez de devolver erro porque quem chega aqui sem          │
 * │ permissão não errou o formulário — ou a interface está desalinhada  │
 * │ com a regra, e o erro precisa aparecer, ou alguém está forçando.    │
 * │ Nos dois casos, seguir em frente é pior.                            │
 * └─────────────────────────────────────────────────────────────────────┘
 */
export async function exigirEdicao(pathname: string): Promise<void> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile?.active) throw new Error("Sem permissão para alterar.");

  const escolaId = profile.escolaId ?? (await getCurrentEscolaId());
  const [permissoes, edicao] = await Promise.all([
    permissoesDaEscola(escolaId),
    edicaoDaEscola(escolaId),
  ]);

  if (!podeEditar(profile.role, pathname, permissoes, edicao)) {
    throw new Error("Seu perfil pode consultar esta tela, mas não alterá-la.");
  }
}
