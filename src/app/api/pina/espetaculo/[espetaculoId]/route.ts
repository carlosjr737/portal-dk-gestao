import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PINA_ALLOWED_ORIGIN } from "@/features/pina/config";
import type { DecodedIdToken } from "firebase-admin/auth";
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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ espetaculoId: string }> },
) {
  const { espetaculoId } = await params;

  // Auth: Firebase ID token (a mesma sessão que o SSO criou no Pina).
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const firebaseAuth = getPinaFirebaseAuth();
  if (!firebaseAuth) {
    return json({ error: "firebase_not_configured" }, 503);
  }
  if (!token) {
    return json({ error: "unauthorized" }, 401);
  }
  let claims: DecodedIdToken;
  try {
    claims = await firebaseAuth.verifyIdToken(token);
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
  // As claims foram assinadas por nós no /sso-token.
  const viewer = {
    role: claims.role === "professor" ? ("professor" as const) : ("master" as const),
    staffMemberId: (claims.professorId as string | null) ?? null,
  };

  const admin = createAdminClient();

  const { data: espetaculo, error: espError } = await admin
    .from("espetaculo")
    .select("id, nome")
    .eq("id", espetaculoId)
    .maybeSingle();

  if (espError || !espetaculo) {
    return json({ error: "not_found" }, 404);
  }

  // Personagens deste espetáculo (LGPD: só id, nome, cor, alunoId).
  const personagens = await fetchPersonagens(admin, espetaculoId);

  const { data: coreografiasRaw } = await admin
    .from("coreografia")
    .select("id, nome, tipo, musica_texto, audio_url, duracao_segundos, ordem")
    .eq("espetaculo_id", espetaculoId)
    .order("ordem", { ascending: true });

  const allCoreoIds = (coreografiasRaw ?? []).map((c) => c.id as string);

  // ---- visibilidade (RLS replicada na API; admin/equipe vê tudo, professor só as suas) ----
  let visibleIds: string[];
  if (viewer.role === "professor") {
    if (!viewer.staffMemberId || allCoreoIds.length === 0) {
      visibleIds = [];
    } else {
      const { data } = await admin
        .from("coreografia_professor")
        .select("coreografia_id")
        .in("coreografia_id", allCoreoIds)
        .eq("professor_id", viewer.staffMemberId);
      visibleIds = (data ?? []).map((r) => r.coreografia_id as string);
    }
  } else {
    visibleIds = allCoreoIds;
  }

  const coreografias = (coreografiasRaw ?? []).filter((c) =>
    visibleIds.includes(c.id as string),
  );

  if (coreografias.length === 0) {
    return json({
      espetaculo: { id: espetaculo.id, nome: espetaculo.nome },
      coreografias: [],
      personagens,
    });
  }

  // ---- vínculos das coreografias visíveis ----
  const [{ data: ctRows }, { data: cpRows }, { data: caRows }] = await Promise.all([
    admin.from("coreografia_turma").select("coreografia_id, turma_id").in("coreografia_id", visibleIds),
    admin.from("coreografia_professor").select("coreografia_id, professor_id").in("coreografia_id", visibleIds),
    admin.from("coreografia_aluno").select("coreografia_id, aluno_id").in("coreografia_id", visibleIds),
  ]);

  const turmasByCoreo = groupBy(ctRows ?? [], "coreografia_id", "turma_id");
  const profsByCoreo = groupBy(cpRows ?? [], "coreografia_id", "professor_id");
  const alunosManualByCoreo = groupBy(caRows ?? [], "coreografia_id", "aluno_id");

  const allTurmaIds = uniq((ctRows ?? []).map((r) => r.turma_id as string));
  const allProfIds = uniq((cpRows ?? []).map((r) => r.professor_id as string));

  // matrículas ativas das turmas -> alunos
  const enrByTurma = new Map<string, string[]>();
  if (allTurmaIds.length > 0) {
    const { data: enr } = await admin
      .from("enrollments")
      .select("class_id, student_id")
      .in("class_id", allTurmaIds)
      .eq("status", "active");
    for (const e of enr ?? []) {
      const cid = e.class_id as string;
      const list = enrByTurma.get(cid) ?? [];
      if (e.student_id) list.push(e.student_id as string);
      enrByTurma.set(cid, list);
    }
  }

  // nomes (só id + nome — LGPD)
  const [classesMap, staffMap, studentsMap] = await Promise.all([
    nameMap(admin, "classes", allTurmaIds, "name"),
    nameMap(admin, "staff_members", allProfIds, "full_name", "artistic_name"),
    (async () => {
      // conjunto total de alunos: elenco de turma + manual
      const ids = new Set<string>();
      for (const coreoId of visibleIds) {
        for (const turmaId of turmasByCoreo.get(coreoId) ?? []) {
          for (const sid of enrByTurma.get(turmaId) ?? []) ids.add(sid);
        }
        for (const sid of alunosManualByCoreo.get(coreoId) ?? []) ids.add(sid);
      }
      return nameMap(admin, "students", [...ids], "full_name");
    })(),
  ]);

  const payload = {
    espetaculo: { id: espetaculo.id as string, nome: espetaculo.nome as string },
    personagens,
    coreografias: coreografias.map((c) => {
      const coreoId = c.id as string;
      // elenco distinto
      const elencoIds = new Set<string>();
      for (const turmaId of turmasByCoreo.get(coreoId) ?? []) {
        for (const sid of enrByTurma.get(turmaId) ?? []) elencoIds.add(sid);
      }
      for (const sid of alunosManualByCoreo.get(coreoId) ?? []) elencoIds.add(sid);

      return {
        id: coreoId,
        nome: c.nome as string,
        tipo: c.tipo as string,
        musicaTexto: (c.musica_texto as string | null) ?? null,
        audioUrl: (c.audio_url as string | null) ?? null,
        duracaoSegundos: (c.duracao_segundos as number | null) ?? null,
        ordem: (c.ordem as number) ?? 0,
        turmas: (turmasByCoreo.get(coreoId) ?? []).map((id) => ({
          id,
          nome: classesMap.get(id) ?? "",
        })),
        professores: (profsByCoreo.get(coreoId) ?? []).map((id) => ({
          id,
          nome: staffMap.get(id) ?? "",
        })),
        elenco: [...elencoIds].map((alunoId) => ({
          alunoId,
          nome: studentsMap.get(alunoId) ?? "",
        })),
      };
    }),
  };

  return json(payload);
}

// ---------------- helpers ----------------
type PinaPersonagem = { id: string; nome: string; cor: string; alunoId: string | null };

/** Personagens deste espetáculo (o Pina consome; portal é a fonte da verdade). */
async function fetchPersonagens(
  admin: ReturnType<typeof createAdminClient>,
  espetaculoId: string,
): Promise<PinaPersonagem[]> {
  const { data } = await admin
    .from("personagem")
    .select("id, nome, cor, aluno_id")
    .eq("espetaculo_id", espetaculoId)
    .order("nome", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    cor: p.cor as string,
    alunoId: (p.aluno_id as string | null) ?? null,
  }));
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr)];
}
function groupBy(
  rows: Record<string, unknown>[],
  keyField: string,
  valueField: string,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const k = r[keyField] as string;
    const v = r[valueField] as string;
    const list = map.get(k) ?? [];
    if (v) list.push(v);
    map.set(k, list);
  }
  return map;
}
async function nameMap(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  ids: string[],
  field: string,
  altField?: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const cols = altField ? `id, ${field}, ${altField}` : `id, ${field}`;
  const { data } = await admin.from(table).select(cols).in("id", ids);
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const name =
      (altField ? (row[altField] as string | null) : null) ||
      (row[field] as string | null) ||
      "";
    map.set(row.id as string, name);
  }
  return map;
}
