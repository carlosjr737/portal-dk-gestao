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
