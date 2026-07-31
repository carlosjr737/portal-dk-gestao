import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";
import { SubcontaPreviewForm } from "@/features/baas/subconta-preview-form";

export const dynamic = "force-dynamic";

/**
 * PROTÓTIPO — não é uma feature em produção.
 *
 * Cria uma subconta REAL no ambiente SANDBOX do Asaas (via ASAAS_API_KEY),
 * só pra gerar evidência funcional pro checklist de BaaS (pergunta 06: print
 * da tela de criação de conta/subconta com o selo aplicado). Não grava nada
 * no banco do portal — o multi-tenant (`escola_id`/tabela `school`) ainda
 * não existe. Depois do contrato de BaaS assinado, esta tela vira a base
 * real da criação de subconta por escola (trocando sandbox por produção).
 */
export default async function BaasPreviewPage() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title="Nova escola (sub-conta) — protótipo"
        description="Cria uma subconta real no sandbox do Asaas, com o selo aplicado. Usado como evidência para o checklist de BaaS."
      />

      <div className="mt-6 flex justify-center">
        <SubcontaPreviewForm />
      </div>
    </div>
  );
}
