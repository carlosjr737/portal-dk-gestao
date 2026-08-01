import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  canAccessPath,
  exigeModuloFinanceiro,
} from "@/features/auth/permissions";
import { getEscolaNome } from "@/features/school/escola-nome";
import { escolaUsaModuloFinanceiro } from "@/features/school/modulo-financeiro";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { getSituacaoAssinatura } from "@/features/plataforma/assinatura-guard";
import { AvisoAssinatura } from "@/features/plataforma/aviso-assinatura";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileByUserId(user.id);

  if (!profile?.active) {
    redirect("/auth/logout?reason=inactive");
  }

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/dashboard";

  if (!canAccessPath(profile.role, pathname)) {
    redirect("/acesso-nao-autorizado");
  }

  // Escola que não cobra pelo sistema não tem como saber quem está devendo.
  // Esconder do menu não basta: a URL continuaria acessível.
  const usaModuloFinanceiro = await escolaUsaModuloFinanceiro(
    profile.escolaId ?? null,
  );
  if (!usaModuloFinanceiro && exigeModuloFinanceiro(pathname)) {
    redirect("/financeiro");
  }

  // Assinatura vencida além da carência suspende o acesso ao sistema.
  const assinatura = await getSituacaoAssinatura(profile.escolaId ?? (await getCurrentEscolaId()));
  if (assinatura.bloqueada) {
    redirect("/assinatura-pendente");
  }

  const escolaNome = await getEscolaNome(profile.escolaId ?? null);

  return (
    <AppShell
      profile={profile}
      usaModuloFinanceiro={usaModuloFinanceiro}
      escolaNome={escolaNome}
    >
      {assinatura.emAviso ? (
        <AvisoAssinatura
          diasDeAtraso={assinatura.diasDeAtraso}
          vencimento={assinatura.vencimento}
        />
      ) : null}
      {children}
    </AppShell>
  );
}
