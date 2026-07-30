import "server-only";

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirebaseServiceAccount } from "@/features/pina/config";

let cachedApp: App | null = null;

function getPinaFirebaseApp(): App | null {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  if (cachedApp) {
    return cachedApp;
  }
  const sa = getFirebaseServiceAccount();
  if (!sa) {
    return null;
  }
  cachedApp = initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      // A chave vem de env com "\n" escapado — normaliza.
      privateKey: sa.private_key.replace(/\\n/g, "\n"),
    }),
  });
  return cachedApp;
}

/** Retorna o Auth do Firebase Admin, ou null se o service account não estiver em env. */
export function getPinaFirebaseAuth(): Auth | null {
  const app = getPinaFirebaseApp();
  return app ? getAuth(app) : null;
}
