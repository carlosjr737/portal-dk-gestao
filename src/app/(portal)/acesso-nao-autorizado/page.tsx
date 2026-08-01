import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";
import { getHomeForRole, roleLabels } from "@/features/auth/permissions";
import { buttonVariants } from "@/components/ui/button";

/**
 * Tela de acesso negado.
 *
 * Antes era uma tarja amarela com três palavras — "Acesso não autorizado." —
 * sem título, sem explicação e sem saída. Quem caía aqui não sabia se tinha
 * errado o endereço, se o sistema quebrou ou se precisava pedir algo a alguém,
 * e o único caminho de volta era o botão do navegador.
 *
 * Agora diz o que aconteceu, com que perfil a pessoa está logada (metade dos
 * casos é conta trocada) e oferece o caminho de volta certo para o papel dela.
 */
export default async function AcessoNaoAutorizadoPage() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  const destino = profile ? getHomeForRole(profile.role) : "/dashboard";

  return (
    <div>
      <PageHeader
        title="Acesso não autorizado"
        description="Esta tela não faz parte do seu perfil de acesso."
      />

      <section className="mt-6 max-w-2xl rounded-md border border-border bg-white p-6">
        <p className="text-sm leading-6 text-foreground">
          Você está autenticado
          {profile?.email ? (
            <>
              {" como "}
              <strong className="font-medium">{profile.email}</strong>
            </>
          ) : null}
          {profile ? (
            <>
              {", com o perfil "}
              <strong className="font-medium">{roleLabels[profile.role]}</strong>
            </>
          ) : null}
          . Esse perfil não abre esta página.
        </p>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Se você precisa deste acesso para o seu trabalho, peça a um
          administrador da escola para revisar o seu perfil em Configurações →
          Usuários. Se entrou com a conta errada, saia e entre de novo.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={destino}
            className={buttonVariants()}
          >
            Voltar ao início
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline" })}
          >
            Entrar com outra conta
          </Link>
        </div>
      </section>
    </div>
  );
}
