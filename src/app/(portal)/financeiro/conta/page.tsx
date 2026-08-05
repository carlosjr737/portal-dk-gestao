import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { getContaDigital } from "@/features/baas/conta-queries";
import { ContaDigitalView } from "@/features/baas/conta-digital";

export const dynamic = "force-dynamic";

/**
 * Conta digital da escola.
 *
 * Responde três perguntas, nesta ordem: quanto tenho, de onde veio, como
 * cobro.
 *
 * SÓ ADMIN, como todo o resto do Financeiro. O papel `equipe` não alcança
 * `/financeiro` em `permissions.ts`, e abrir só esta rota para ele daria à
 * secretaria a visão de saldo da escola — decisão de produto, não detalhe de
 * implementação. Se for para liberar, libera no modelo de permissão, não aqui.
 */
export default async function ContaPage({
  searchParams,
}: {
  /**
   * `estornada` traz o id da cobrança que acabou de ser estornada.
   *
   * Vem pela URL porque a confirmação precisa sobreviver ao re-render: ao
   * estornar, a cobrança deixa de ser estornável e o botão some — levando
   * junto qualquer mensagem que morasse nele.
   */
  searchParams?: Promise<{ estornada?: string }>;
}) {
  const params = await searchParams;
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;

  if (!profile || profile.role !== "admin") {
    redirect("/acesso-nao-autorizado");
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) redirect("/financeiro");

  const conta = await getContaDigital(escolaId);

  return (
    <div>
      <PageHeader
        title="Conta da escola"
        description="O dinheiro que entrou pelas cobranças do sistema."
        actions={
          <Link href="/financeiro" className={buttonVariants({ variant: "outline" })}>
            Financeiro
          </Link>
        }
      />
      <ContaDigitalView conta={conta} estornada={params?.estornada ?? null} />
    </div>
  );
}
