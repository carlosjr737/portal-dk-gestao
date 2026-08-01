import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { SchoolForm, type SchoolData } from "@/features/school/school-form";

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
          "nome, razao_social, representante_legal, cnpj, email, telefone, cep, logradouro, numero, complemento, bairro, cidade, uf, kyc_status, asaas_account_id",
        )
        .eq("id", escolaId)
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <PageHeader
        title="Minha escola"
        description="Dados cadastrais usados no contrato do aluno e no cadastro da conta de pagamentos."
      />

      {!school ? (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Seu usuário não está vinculado a uma escola. Procure o suporte.
        </p>
      ) : (
        <>
          <section className="mt-6 rounded-md border border-border bg-white p-5">
            <SchoolForm school={school as unknown as SchoolData} />
          </section>

          <section className="mt-6 rounded-md border border-border bg-white p-5">
            <h2 className="text-base font-semibold text-foreground">
              Conta de pagamentos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sub-conta usada para receber as mensalidades. É criada na etapa de
              integração com o provedor — ainda não disponível.
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Status do cadastro</dt>
                <dd className="font-medium text-foreground">
                  {(school.kyc_status as string | null) ?? "pendente"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Identificador da conta</dt>
                <dd className="font-medium text-foreground">
                  {(school.asaas_account_id as string | null) ?? "—"}
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
