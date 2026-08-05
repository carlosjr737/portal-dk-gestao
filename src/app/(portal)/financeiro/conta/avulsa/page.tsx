import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { ASAAS_ENV } from "@/features/baas/config";
import { consultarTaxas, obterCobranca } from "@/features/baas/asaas-conta";
import { AvulsaForm } from "@/features/baas/avulsa-form";

export const dynamic = "force-dynamic";

/** Vencimento padrão: daqui a uma semana, para a família ter prazo. */
function emUmaSemana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Cobrança avulsa — uma cobrança só, fora da mensalidade recorrente.
 *
 * Nasceu de um caso concreto: uma mensalidade estornada que precisa voltar a
 * ser cobrada. Por isso o caminho principal é `?refazer=<id>`, que chega com
 * tudo preenchido — quem acabou de estornar não deve redigitar nada.
 */
export default async function AvulsaPage({
  searchParams,
}: {
  searchParams?: Promise<{ refazer?: string }>;
}) {
  const params = await searchParams;
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;

  if (!profile || profile.role !== "admin") {
    redirect("/acesso-nao-autorizado");
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) redirect("/financeiro");

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("school_payment_credentials")
    .select("api_key")
    .eq("escola_id", escolaId)
    .eq("environment", ASAAS_ENV)
    .maybeSingle();

  const chave = (cred?.api_key as string | undefined) ?? null;

  if (!chave) {
    return (
      <div>
        <PageHeader title="Nova cobrança" />
        <div className="mt-6">
          <Alert tone="info">
            Esta escola ainda não tem conta de pagamentos.{" "}
            <Link
              href="/financeiro/conta-pagamentos"
              className="font-medium underline"
            >
              Criar agora
            </Link>
          </Alert>
        </div>
      </div>
    );
  }

  // Vindo de "Refazer cobrança": o formulário chega preenchido.
  const original = params?.refazer
    ? await obterCobranca(chave, params.refazer)
    : null;

  /*
   * O "refazer" sugere o NOME de quem pagava, não um id.
   *
   * O campo virou busca, e a busca é por nome — devolver um id aqui obrigaria
   * a tela a resolver o nome de novo só para mostrar. Vindo o nome, ele já
   * chega digitado no campo e a lista aparece filtrada.
   */
  const nomeSugerido = original
    ? ((
        await admin
          .from("aluno_assinatura")
          .select("guardians(full_name)")
          .eq("asaas_customer_id", original.customerId)
          .limit(1)
          .maybeSingle()
      ).data as { guardians?: { full_name?: string } | null } | null)?.guardians
        ?.full_name ?? ""
    : "";

  const taxas = await consultarTaxas(chave);

  return (
    <div>
      <PageHeader
        title={original ? "Refazer cobrança" : "Nova cobrança"}
        description={
          original
            ? "Reemite uma cobrança sem tocar na matrícula."
            : "Uma cobrança só, fora da mensalidade."
        }
        actions={
          <Link
            href="/financeiro/conta"
            className={buttonVariants({ variant: "outline" })}
          >
            Voltar para a conta
          </Link>
        }
      />

      {original ? (
        <div className="mt-6">
          <Alert tone="info">
            Refazendo a cobrança de{" "}
            {original.valor.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}{" "}
            que vencia em {original.vencimento.split("-").reverse().join("/")}.
            Confira os campos e ajuste o que precisar.
          </Alert>
        </div>
      ) : null}

      <AvulsaForm
        taxa={taxas.boleto ?? taxas.pix}
        inicial={{
          nomeSugerido,
          valor: original
            ? original.valor.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })
            : "",
          descricao: original?.descricao ?? "",
          vencimento: emUmaSemana(),
        }}
      />
    </div>
  );
}
