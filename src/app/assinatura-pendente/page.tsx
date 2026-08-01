import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser, getCurrentEscolaId } from "@/features/auth/session";
import { getSituacaoAssinatura } from "@/features/plataforma/assinatura-guard";

export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Tela mostrada quando o acesso está bloqueado por assinatura vencida.
 *
 * Fica FORA do grupo (portal) de propósito: se estivesse dentro, o próprio
 * layout que bloqueia redirecionaria para cá em loop.
 */
export default async function AssinaturaPendentePage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const escolaId = await getCurrentEscolaId();
  const situacao = await getSituacaoAssinatura(escolaId);

  // Regularizou (ou nunca esteve bloqueada): volta para o portal.
  if (!situacao.bloqueada) {
    redirect("/dashboard");
  }

  const cancelada = situacao.status === "cancelada";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <div className="w-full max-w-lg rounded-lg border border-border bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Portal DK Gestão
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {cancelada ? "Assinatura cancelada" : "Assinatura em atraso"}
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          {cancelada
            ? "O acesso ao sistema está suspenso porque a assinatura foi cancelada."
            : `O acesso ao sistema está suspenso porque a assinatura está vencida há ${situacao.diasDeAtraso} ${
                situacao.diasDeAtraso === 1 ? "dia" : "dias"
              }.`}
        </p>

        {situacao.valor != null ? (
          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Valor</dt>
              <dd className="font-medium text-foreground">{brl.format(situacao.valor)}</dd>
            </div>
            {situacao.vencimento ? (
              <div>
                <dt className="text-xs text-muted-foreground">Vencimento</dt>
                <dd className="font-medium text-foreground">
                  {situacao.vencimento.split("-").reverse().join("/")}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <p className="mt-5 text-sm text-muted-foreground">
          A cobrança foi enviada para o e-mail da escola. Assim que o pagamento
          for confirmado, o acesso volta automaticamente — não precisa avisar
          ninguém.
        </p>

        <p className="mt-2 text-sm text-muted-foreground">
          Se já pagou nas últimas horas, aguarde a confirmação e recarregue esta
          página.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/assinatura-pendente"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Já paguei, verificar
          </Link>
          <Link
            href="/auth/logout"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Sair
          </Link>
        </div>
      </div>
    </main>
  );
}
