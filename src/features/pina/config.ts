import "server-only";

/** URL do app Pina (para o botão "Abrir no Pina"). */
export const PINA_APP_URL = process.env.PINA_APP_URL ?? "https://www.pinaform.app";

/** Origin permitido no CORS da API do Pina. */
export const PINA_ALLOWED_ORIGIN =
  process.env.PINA_ALLOWED_ORIGIN ?? "https://www.pinaform.app";

/** Para onde voltar depois de definir a senha (login do Pina). */
export const PINA_LOGIN_URL =
  process.env.PINA_LOGIN_URL ?? "https://www.pinaform.app/login";

/**
 * Página do PRÓPRIO Pina que trata o oobCode (resetPassword) e faz o redirect.
 * O portal monta o link apontando pra cá — sem depender do Custom Action URL
 * do Firebase nem de domínio autorizado.
 */
export const PINA_AUTH_ACTION_URL =
  process.env.PINA_AUTH_ACTION_URL ?? `${PINA_APP_URL}/auth/action`;

/** Para onde o /auth/action redireciona depois de definir a senha (lista do professor). */
export const PINA_CONTINUE_URL = process.env.PINA_CONTINUE_URL ?? `${PINA_APP_URL}/`;

/**
 * Service account do Firebase "pinaform-a5fec", lido de env (JSON em string).
 * NUNCA fica no repositório — só em env/secret manager. Retorna null se ausente.
 */
export function getFirebaseServiceAccount(): {
  project_id: string;
  client_email: string;
  private_key: string;
} | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
