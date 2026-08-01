import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { EspetaculoForm } from "@/features/espetaculo/espetaculo-form";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EspetaculosPage() {
  const supabase = await createClient();
  const { data: espetaculos } = await supabase
    .from("espetaculo")
    .select("id, nome, temporada, data_evento")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Espetáculos"
        description="Coreografias, turmas, professores e músicas — a fonte da verdade que o Pina consome."
      />

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-foreground">Novo espetáculo</h2>
        <div className="mt-3">
          <EspetaculoForm />
        </div>
      </Card>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Espetáculos cadastrados</h2>
        </div>
        <ul className="divide-y divide-border">
          {(espetaculos ?? []).length > 0 ? (
            (espetaculos ?? []).map((e) => (
              <li key={e.id as string}>
                <Link
                  href={`/espetaculos/${e.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-muted/50"
                >
                  <span className="font-medium text-foreground">{e.nome as string}</span>
                  <span className="text-sm text-muted-foreground">
                    {(e.temporada as string | null) ?? ""}
                    {e.data_evento ? ` · ${(e.data_evento as string).split("-").reverse().join("/")}` : ""}
                  </span>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhum espetáculo cadastrado ainda.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
