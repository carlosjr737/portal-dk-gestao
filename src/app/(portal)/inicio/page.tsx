import { redirect } from "next/navigation";
import { getAuthenticatedUser, getCurrentEscolaId, getProfileByUserId } from "@/features/auth/session";
import { getHomeForRole } from "@/features/auth/permissions";
import { permissoesDaEscola } from "@/features/auth/permissoes-escola";

export const dynamic = "force-dynamic";

/**
 * A porta de entrada depois do login.
 *
 * O middleware mandava todo mundo para /dashboard na marra. Ele não tem como
 * saber o papel — só enxerga que existe alguém logado —, e quando a escola
 * tirou o Dashboard do professor, o login virou um beco: entrava, levava
 * "acesso negado" e não tinha chegado a lugar nenhum de onde navegar.
 *
 * Esta rota existe para adiar essa decisão até onde o papel e as permissões
 * da escola são conhecidos. Ela não renderiza nada: só redireciona.
 */
export default async function InicioPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const profile = await getProfileByUserId(user.id);
  if (!profile) redirect("/login");

  const escolaId = profile.escolaId ?? (await getCurrentEscolaId());
  const permissoes = await permissoesDaEscola(escolaId);

  redirect(getHomeForRole(profile.role, permissoes));
}
