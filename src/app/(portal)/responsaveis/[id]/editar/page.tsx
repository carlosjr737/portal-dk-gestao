import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { updateGuardian } from "@/features/guardians/actions";
import { GuardianForm } from "@/features/guardians/guardian-form";
import type { Guardian } from "@/features/guardians/types";

type EditarResponsavelPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarResponsavelPage({
  params,
}: EditarResponsavelPageProps) {
  const { id } = await params;
  const guardian = await getGuardian(id);

  if (!guardian) {
    notFound();
  }

  const updateGuardianWithId = updateGuardian.bind(null, guardian.id);

  return (
    <div>
      <PageHeader
        title="Editar responsável"
        description={`Atualize o cadastro de ${guardian.full_name}.`}
      />
      <GuardianForm
        action={updateGuardianWithId}
        defaultValues={guardian}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}

async function getGuardian(id: string): Promise<Guardian | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("guardians")
      .select("id, full_name, document, phone, email, notes, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Guardian edit load error:", error.message);
      return null;
    }

    return data as Guardian | null;
  } catch (error) {
    console.error(
      "Guardian edit load error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
