import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { SchoolForm, type SchoolData } from "@/features/school/school-form";
import { ContaPagamentosCard } from "@/features/baas/conta-pagamentos-card";
import { ASAAS_ENV } from "@/features/baas/config";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EscolaPage() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    notFound();
  }

  const escolaId = await getCurrentEscolaId();
  const supabase = await createClient();
  const { data: school } = escolaId
    ? await supabase
        .from("school")
        .select(
          "nome, razao_social, representante_legal, cnpj, email, telefone, cep, logradouro, numero, complemento, bairro, cidade, uf, kyc_status, asaas_account_id, asaas_wallet_id",
        )
        .eq("id", escolaId)
        .maybeSingle()
    : { data: null };

  /*
   * A conta exibida é a DO AMBIENTE ATUAL, não a última criada.
   *
   * É isso que faz a troca de dev para prod ser só uma variável de ambiente:
   * em produção não existe credencial ainda, o card volta a mostrar o
   * formulário, e a conta de sandbox continua guardada para quando o ambiente
   * voltar. `school.asaas_account_id` guarda a última criada e serviria para
   * qualquer ambiente — era ele que prendia a escola na primeira conta.
   *
   * A tabela de credenciais não tem policy: só o backend lê, daí o admin.
   */
  const { data: conta } = escolaId
    ? await createAdminClient()
        .from("school_payment_credentials")
        .select("account_id, wallet_id, kyc_status")
        .eq("escola_id", escolaId)
        .eq("environment", ASAAS_ENV)
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <PageHeader
        title="Minha escola"
        description="Dados cadastrais usados no contrato do aluno e no cadastro da conta de pagamentos."
      />

      {!school ? (
        <Alert tone="warning" className="mt-6">
          Seu usuário não está vinculado a uma escola. Procure o suporte.
        </Alert>
      ) : (
        <>
          <Card className="mt-6 p-5">
            <SchoolForm school={school as unknown as SchoolData} />
          </Card>

          <Card className="mt-6 p-5">
            <ContaPagamentosCard
              // `kyc_status` da credencial pode não existir enquanto
              // baas_04_conta_por_ambiente.sql não rodar; cai no da escola.
              kycStatus={
                ((conta?.kyc_status as string | null) ??
                  (school.kyc_status as string | null)) ??
                null
              }
              accountId={(conta?.account_id as string | null) ?? null}
              walletId={(conta?.wallet_id as string | null) ?? null}
              ambiente={ASAAS_ENV}
            />
          </Card>
        </>
      )}
    </div>
  );
}
