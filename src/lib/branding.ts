/**
 * Nome do produto.
 *
 * A plataforma nasce independente do DK: nenhuma tela cita "Portal DK" nem
 * "DK Studio". Onde o assunto é a instituição, a interface mostra a escola
 * do usuário logado (`school.nome`); onde o assunto é o produto, mostra
 * daqui.
 *
 * O nome comercial saiu em agosto/2026: **SouAle**. Ele continua vindo de
 * env, e o padrão deixou de ser o genérico "Plataforma" — assim um ambiente
 * sem a variável mostra a marca em vez de um placeholder, que era o que
 * acontecia até agora em produção.
 *
 * `NEXT_PUBLIC_` porque a barra lateral é componente de cliente.
 */
export const PLATFORM_NAME =
  process.env.NEXT_PUBLIC_PLATFORM_NAME?.trim() || "SouAle";

export const PLATFORM_TAGLINE =
  process.env.NEXT_PUBLIC_PLATFORM_TAGLINE?.trim() ||
  "Gestão para escolas de dança e artes";

/** Domínio público, usado em metadata e canonical. */
export const PLATFORM_URL =
  process.env.NEXT_PUBLIC_PLATFORM_URL?.trim() || "https://souale.com.br";

export const PLATFORM_DESCRIPTION = `${PLATFORM_NAME} — ${PLATFORM_TAGLINE}.`;
