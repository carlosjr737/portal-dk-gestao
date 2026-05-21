import { PageHeader } from "@/components/layout/page-header";
import { createGuardian } from "@/features/guardians/actions";
import { GuardianForm } from "@/features/guardians/guardian-form";

export default function NovoResponsavelPage() {
  return (
    <div>
      <PageHeader
        title="Novo responsável"
        description="Cadastre as informações principais do responsável."
      />
      <GuardianForm action={createGuardian} submitLabel="Criar responsável" />
    </div>
  );
}
