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
import { consultarTaxas } from "@/features/baas/asaas-conta";
import { QrAvulsoForm } from "@/features/baas/qr-avulso-form";

export const dynamic = "force-dynamic";

/**
 * Cobrança avulsa por QR Code Pix.
 *
 * Rota própria porque é tarefa, não consulta — mas alcançada pelo botão
 * primário da conta. Serve o que não passa por contrato: figurino, taxa de
 * festival, aula avulsa, matrícula.
 */
export default async function CobrarPage() {
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

  // A taxa é carregada aqui, no servidor, para o formulário mostrar o líquido
  // enquanto a pessoa digita — sem expor a chave da conta ao navegador.
  const taxas = chave
    ? await consultarTaxas(chave)
    : { pix: null, boleto: null, pixGratisPorMes: null, pixUsadosNoMes: null };

  return (
    <div>
      <PageHeader
        title="Cobrar por QR Code"
        description="Para o que não é mensalidade: figurino, festival, aula avulsa."
        actions={
          <Link
            href="/financeiro/conta"
            className={buttonVariants({ variant: "outline" })}
          >
            Voltar para a conta
          </Link>
        }
      />

      {chave ? (
        <QrAvulsoForm taxaPix={taxas.pix} />
      ) : (
        <div className="mt-6">
          <Alert tone="info">
            Esta escola ainda não tem conta de pagamentos.{" "}
            <Link href="/financeiro/conta-pagamentos" className="font-medium underline">
              Criar agora
            </Link>
          </Alert>
        </div>
      )}
    </div>
  );
}
