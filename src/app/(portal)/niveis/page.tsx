import { PageHeader } from "@/components/layout/page-header";
import { CatalogItemForm } from "@/features/class-catalog/catalog-item-form";
import { createLevel, updateLevel } from "@/features/class-catalog/actions";
import { formatCatalogStatus } from "@/features/class-catalog/formatters";
import type { CatalogItem } from "@/features/class-catalog/types";
import { formatText } from "@/features/students/formatters";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NiveisPage() {
  const levels = await getLevels();

  return (
    <div>
      <PageHeader
        title="Níveis"
        description="Cadastro dos níveis pedagógicos usados nas turmas."
      />

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">Novo nível</h2>
        <CatalogItemForm action={createLevel} submitLabel="Cadastrar nível" />
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            Níveis cadastrados
          </h2>
        </div>

        <div className="divide-y divide-border">
          {levels.length > 0 ? (
            levels.map((level) => {
              const updateLevelWithId = updateLevel.bind(null, level.id);

              return (
                <details key={level.id} className="group">
                  <summary className="grid cursor-pointer gap-3 px-5 py-4 text-sm marker:hidden md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center">
                    <div>
                      <p className="font-medium text-foreground">
                        {level.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatText(level.description)}
                      </p>
                    </div>
                    <span className="text-muted-foreground">
                      Ordem {level.sort_order}
                    </span>
                    <span className="text-muted-foreground">
                      {formatCatalogStatus(level.status)}
                    </span>
                    <span className="text-sm font-medium text-primary group-open:hidden">
                      Editar
                    </span>
                  </summary>
                  <div className="bg-muted/40 px-5 pb-5">
                    <CatalogItemForm
                      action={updateLevelWithId}
                      defaultValues={level}
                      submitLabel="Salvar alterações"
                      compact
                    />
                  </div>
                </details>
              );
            })
          ) : (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum nível cadastrado.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

async function getLevels(): Promise<CatalogItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("levels")
      .select("id, name, description, status, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Levels list load error:", error.message);
      return [];
    }

    return (data ?? []) as CatalogItem[];
  } catch (error) {
    console.error(
      "Levels list load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
