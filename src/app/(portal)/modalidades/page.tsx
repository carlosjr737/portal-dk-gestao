import { PageHeader } from "@/components/layout/page-header";
import { CatalogItemForm } from "@/features/class-catalog/catalog-item-form";
import {
  createModality,
  updateModality,
} from "@/features/class-catalog/actions";
import { formatCatalogStatus } from "@/features/class-catalog/formatters";
import type { CatalogItem } from "@/features/class-catalog/types";
import { formatText } from "@/features/students/formatters";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ModalidadesPage() {
  const modalities = await getModalities();

  return (
    <div>
      <PageHeader
        title="Modalidades"
        description="Cadastro das modalidades artísticas usadas nas turmas."
      />

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">
          Nova modalidade
        </h2>
        <CatalogItemForm
          action={createModality}
          submitLabel="Cadastrar modalidade"
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            Modalidades cadastradas
          </h2>
        </div>

        <div className="divide-y divide-border">
          {modalities.length > 0 ? (
            modalities.map((modality) => {
              const updateModalityWithId = updateModality.bind(
                null,
                modality.id,
              );

              return (
                <details key={modality.id} className="group">
                  <summary className="grid cursor-pointer gap-3 px-5 py-4 text-sm marker:hidden md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center">
                    <div>
                      <p className="font-medium text-foreground">
                        {modality.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatText(modality.description)}
                      </p>
                    </div>
                    <span className="text-muted-foreground">
                      Ordem {modality.sort_order}
                    </span>
                    <span className="text-muted-foreground">
                      {formatCatalogStatus(modality.status)}
                    </span>
                    <span className="text-sm font-medium text-primary group-open:hidden">
                      Editar
                    </span>
                  </summary>
                  <div className="bg-muted/40 px-5 pb-5">
                    <CatalogItemForm
                      action={updateModalityWithId}
                      defaultValues={modality}
                      submitLabel="Salvar alterações"
                      compact
                    />
                  </div>
                </details>
              );
            })
          ) : (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhuma modalidade cadastrada.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

async function getModalities(): Promise<CatalogItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("modalities")
      .select("id, name, description, status, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Modalities list load error:", error.message);
      return [];
    }

    return (data ?? []) as CatalogItem[];
  } catch (error) {
    console.error(
      "Modalities list load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
