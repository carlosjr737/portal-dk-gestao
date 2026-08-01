/**
 * Nome do produto.
 *
 * A plataforma nasce independente do DK: nenhuma tela cita "Portal DK" nem
 * "DK Studio". Onde o assunto é a instituição, a interface mostra a escola
 * do usuário logado (`school.nome`); onde o assunto é o produto, mostra
 * daqui.
 *
 * Enquanto o nome comercial não sai (fase 5 da direção de identidade), ele
 * vive numa variável de ambiente — trocar o nome no dia do lançamento é
 * editar o `.env`, não caçar string em vinte arquivos.
 *
 * `NEXT_PUBLIC_` porque a barra lateral é componente de cliente.
 */
export const PLATFORM_NAME =
  process.env.NEXT_PUBLIC_PLATFORM_NAME?.trim() || "Plataforma";

export const PLATFORM_TAGLINE =
  process.env.NEXT_PUBLIC_PLATFORM_TAGLINE?.trim() ||
  "Gestão para escolas de artes";

export const PLATFORM_DESCRIPTION = `${PLATFORM_NAME} — ${PLATFORM_TAGLINE}.`;
