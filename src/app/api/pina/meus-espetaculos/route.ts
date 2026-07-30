import { NextResponse, type NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PINA_ALLOWED_ORIGIN } from "@/features/pina/config";
import { getPinaFirebaseAuth } from "@/features/pina/firebase-admin";

export const dynamic = "force-dynamic";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": PINA_ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const firebaseAuth = getPinaFirebaseAuth();
  if (!firebaseAuth) return json({ error: "firebase_not_configured" }, 503);
  if (!token) return json({ error: "unauthorized" }, 401);

  let claims: DecodedIdToken;
  try {
    claims = await firebaseAuth.verifyIdToken(token);
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
  const role = claims.role === "professor" ? "professor" : "master";
  const professorId = (claims.professorId as string | null) ?? null;

  const admin = createAdminClient();

  // master vê todos; professor vê só onde participa (coreografia_professor)
  if (role !== "professor") {
    const { data } = await admin
      .from("espetaculo")
      .select("id, nome")
      .order("created_at", { ascending: false });
    return json({ espetaculos: data ?? [] });
  }

  if (!professorId) return json({ espetaculos: [] });

  // espetáculos que têm ao menos uma coreografia com esse professor
  const { data: cps } = await admin
    .from("coreografia_professor")
    .select("coreografia_id")
    .eq("professor_id", professorId);
  const coreoIds = [...new Set((cps ?? []).map((r) => r.coreografia_id as string))];
  if (coreoIds.length === 0) return json({ espetaculos: [] });

  const { data: coreos } = await admin
    .from("coreografia")
    .select("espetaculo_id")
    .in("id", coreoIds);
  const espIds = [...new Set((coreos ?? []).map((r) => r.espetaculo_id as string))];
  if (espIds.length === 0) return json({ espetaculos: [] });

  const { data: esps } = await admin
    .from("espetaculo")
    .select("id, nome")
    .in("id", espIds)
    .order("created_at", { ascending: false });

  return json({ espetaculos: esps ?? [] });
}
