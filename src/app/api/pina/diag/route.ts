import { NextResponse } from "next/server";
import { getFirebaseServiceAccount } from "@/features/pina/config";

export const dynamic = "force-dynamic";

// Diagnóstico TEMPORÁRIO — não expõe a chave privada, só metadados.
export async function GET() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT ?? null;
  const sa = getFirebaseServiceAccount();
  return NextResponse.json({
    hasEnv: Boolean(raw),
    envLength: raw?.length ?? 0,
    startsWith: raw ? raw.slice(0, 1) : null, // "{" se for JSON
    parsedOk: Boolean(sa),
    projectId: sa?.project_id ?? null, // não é segredo
    hasPinaUrl: Boolean(process.env.PINA_APP_URL),
  });
}
