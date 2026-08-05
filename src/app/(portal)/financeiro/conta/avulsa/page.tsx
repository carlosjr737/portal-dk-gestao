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
import {
  AvulsaForm,
  type ResponsavelOpcao,
} from "@/features/baas/avulsa-form";

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

  /*
   * Só entram responsáveis QUE JÁ EXISTEM NO PROVEDOR.
   *
   * Uma cobrança avulsa precisa de um cliente lá dentro, e criar um novo aqui
   * duplicaria a pessoa — a mesma família passaria a aparecer duas vezes na
   * lista do provedor, com históricos que nunca mais se juntam. Quem ainda não
   * tem cadastro entra pela mensalidade, uma vez.
   */
  const { data: vinculos } = await admin
    .from("aluno_assinatura")
    .select("guardian_id, guardians(full_name)")
    .eq("escola_id", escolaId)
    .not("asaas_customer_id", "is", null);

  const porId = new Map<string, string>();
  for (const v of vinculos ?? []) {
    const g = (v as { guardians?: { full_name?: string } | null }).guardians;
    const id = (v as { guardian_id?: string }).guardian_id;
    if (id && g?.full_name) porId.set(id, g.full_name);
  }
  const responsaveis: ResponsavelOpcao[] = [...porId.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Vindo de "Refazer cobrança": o formulário chega preenchido.
  const original = params?.refazer
    ? await obterCobranca(chave, params.refazer)
    : null;

  const guardianDaOriginal = original
    ? ((
        await admin
          .from("aluno_assinatura")
          .select("guardian_id")
          .eq("asaas_customer_id", original.customerId)
          .limit(1)
          .maybeSingle()
      ).data?.guardian_id as string | undefined) ?? ""
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
        responsaveis={responsaveis}
        taxa={taxas.boleto ?? taxas.pix}
        inicial={{
          guardianId: guardianDaOriginal,
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
