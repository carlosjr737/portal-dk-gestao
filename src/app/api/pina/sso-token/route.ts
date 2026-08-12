import { NextResponse } from "next/server";
import { getAuthenticatedUser, getCurrentEscolaId } from "@/features/auth/session";
import { resolvePinaViewer } from "@/features/pina/auth";
import { getPinaFirebaseAuth } from "@/features/pina/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * Emite um custom token do Firebase para o usuário logado no portal, para o
 * professor NÃO fazer segundo login no Pina.
 *   uid    = id do professor no portal (staff_members.id) — ou profiles.id se master sem cadastro de professor.
 *   claims = { role: "master"|"professor", escolaId, professorId }
 */
export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const viewer = await resolvePinaViewer(user.id);
  if (!viewer) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const auth = getPinaFirebaseAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "firebase_not_configured" },
      { status: 503 },
    );
  }

  const role = viewer.role === "professor" ? "professor" : "master";

  /*
   * AUX ADM VÊ TUDO E NÃO EDITA NADA.
   *
   * A claim é ADICIONAL, não um papel novo: o Pina continua recebendo
   * role="master" e enxergando a escola inteira. Inventar um role
   * "master_leitura" quebraria toda checagem `role === "master"` lá dentro e
   * trancaria a equipe fora do que ela PODE ver — o oposto do pedido.
   *
   * A CONTRAPARTIDA HONESTA: a edição acontece dentro do Pina, contra o banco
   * DELE. Nossas APIs aqui são só de leitura (só GET). Então esta claim é um
   * pedido assinado, não uma tranca: enquanto o Pina não olhar para
   * `somenteLeitura`, o aux adm continua conseguindo editar por lá.
   */
  const somenteLeitura = viewer.role === "equipe";
  const uid = viewer.staffMemberId ?? viewer.profileId;

  try {
    const token = await auth.createCustomToken(uid, {
      role,
      // A API do Pina usa admin client (ignora RLS), então a fronteira de
      // escola precisa vir assinada no token.
      escolaId: await getCurrentEscolaId(),
      professorId: viewer.staffMemberId,
      somenteLeitura,
    });
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Pina SSO token error:", error);
    return NextResponse.json({ error: "token_error" }, { status: 500 });
  }
}
