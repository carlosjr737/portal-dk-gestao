import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { ASAAS_ENV } from "@/features/baas/config";
import { ContaPagamentosFluxo } from "@/features/baas/conta-pagamentos-fluxo";

export const dynamic = "force-dynamic";

/**
 * Fluxo de criação da conta de pagamentos, em quatro etapas.
 *
 * Antes era um cartão só, com tudo dentro: status, lista do que falta, botão
 * de criar, botão de verificar e documentos. Três problemas que a separação
 * resolve:
 *
 * - a tela dizia o que faltava e os campos viviam em OUTRA tela, então a
 *   pessoa lia o diagnóstico e saía procurando a cura;
 * - o processo tem quatro fases, duas delas de espera, e sem trilha ninguém
 *   sabia se tinha travado, se era com ela ou se era só demorado;
 * - o status só atualizava se alguém clicasse — quem saía para enviar
 *   documento e voltava via a tela velha e concluía que não funcionou.
 */
export default async function ContaPagamentosPage() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;

  /*
   * Criar conta de pagamentos é ato de titular, não de secretaria — as
   * actions já recusam quem não é admin, e deixar a tela abrir mesmo assim
   * só entregaria um formulário que não salva.
   */
  if (!profile || profile.role !== "admin") {
    redirect("/acesso-nao-autorizado");
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) redirect("/financeiro");

  const admin = createAdminClient();
  const [{ data: escola }, { data: cred }] = await Promise.all([
    admin
      .from("school")
      .select(
        "nome, razao_social, cnpj, email, telefone, cep, logradouro, numero, complemento, bairro, company_type, faturamento_estimado, data_nascimento_responsavel, kyc_status, asaas_account_id",
      )
      .eq("id", escolaId)
      .maybeSingle(),
    admin
      .from("school_payment_credentials")
      .select("account_id, kyc_status")
      .eq("escola_id", escolaId)
      .eq("environment", ASAAS_ENV)
      .maybeSingle(),
  ]);

  /*
   * A conta é POR AMBIENTE. Quem tem subconta de sandbox e nenhuma de
   * produção ainda está na etapa 1 quando o sistema está apontando para
   * produção — por isso a credencial do ambiente atual manda, e não
   * `school.asaas_account_id`, que guarda só a última criada.
   */
  const contaCriada = Boolean(cred?.account_id);

  return (
    <div>
      <PageHeader
        title="Conta de pagamentos"
        description="Para cobrar as mensalidades pelo sistema e dar baixa sozinho."
        actions={
          <Link
            href="/financeiro"
            className={buttonVariants({ variant: "outline" })}
          >
            Financeiro
          </Link>
        }
      />

      <ContaPagamentosFluxo
        contaCriada={contaCriada}
        accountId={(cred?.account_id as string | null) ?? null}
        kycStatus={
          (cred?.kyc_status as string | null) ??
          (escola?.kyc_status as string | null) ??
          null
        }
        ambiente={ASAAS_ENV}
        escola={{
          razaoSocial: (escola?.razao_social as string | null) ?? "",
          cnpj: (escola?.cnpj as string | null) ?? "",
          email: (escola?.email as string | null) ?? "",
          telefone: (escola?.telefone as string | null) ?? "",
          cep: (escola?.cep as string | null) ?? "",
          logradouro: (escola?.logradouro as string | null) ?? "",
          numero: (escola?.numero as string | null) ?? "",
          complemento: (escola?.complemento as string | null) ?? "",
          bairro: (escola?.bairro as string | null) ?? "",
          companyType: (escola?.company_type as string | null) ?? "",
          faturamento:
            escola?.faturamento_estimado === null ||
            escola?.faturamento_estimado === undefined
              ? ""
              : String(escola.faturamento_estimado),
          dataNascimento:
            (escola?.data_nascimento_responsavel as string | null) ?? "",
        }}
      />
    </div>
  );
}
