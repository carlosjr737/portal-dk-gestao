import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";
import { getStaffDisplayName } from "@/features/staff/formatters";
import { CoreografiaForm } from "@/features/espetaculo/coreografia-form";
import { DeleteCoreografiaButton } from "@/features/espetaculo/delete-coreografia-button";
import { OpenInPinaButton } from "@/features/pina/open-in-pina-button";
import { PINA_APP_URL } from "@/features/pina/config";
import {
  PersonagemCreate,
  PersonagemRow,
  type PersonagemItem,
} from "@/features/personagem/personagem-ui";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  normal: "Normal",
  flashmob: "Flashmob",
  flashfinal: "Flash final",
  especial: "Especial",
};

export default async function EspetaculoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Gestão do espetáculo é só master/admin/equipe.
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: espetaculo } = await admin
    .from("espetaculo")
    .select("id, nome, temporada, data_evento")
    .eq("id", id)
    .maybeSingle();
  if (!espetaculo) {
    notFound();
  }

  const [
    { data: coreografias },
    { data: classes },
    { data: staff },
    { data: students },
    { data: personagens },
  ] = await Promise.all([
    admin
      .from("coreografia")
      .select("id, nome, tipo, musica_texto, ordem, duracao_segundos")
      .eq("espetaculo_id", id)
      .order("ordem", { ascending: true }),
    admin.from("classes").select("id, name").eq("status", "active").order("name"),
    admin.from("staff_members").select("id, full_name, artistic_name").eq("role", "professor").order("full_name"),
    admin.from("students").select("id, full_name").eq("status", "active").order("full_name"),
    admin
      .from("personagem")
      .select("id, nome, cor, aluno_id")
      .eq("espetaculo_id", id)
      .order("nome", { ascending: true }),
  ]);

  const coreoIds = (coreografias ?? []).map((c) => c.id as string);
  const [{ data: ctRows }, { data: cpRows }] = await Promise.all([
    coreoIds.length
      ? admin.from("coreografia_turma").select("coreografia_id, turma_id").in("coreografia_id", coreoIds)
      : Promise.resolve({ data: [] as { coreografia_id: string; turma_id: string }[] }),
    coreoIds.length
      ? admin.from("coreografia_professor").select("coreografia_id, professor_id").in("coreografia_id", coreoIds)
      : Promise.resolve({ data: [] as { coreografia_id: string; professor_id: string }[] }),
  ]);

  const classMap = new Map((classes ?? []).map((c) => [c.id as string, c.name as string]));
  const staffMap = new Map(
    (staff ?? []).map((s) => [s.id as string, getStaffDisplayName(s)]),
  );
  const turmasByCoreo = new Map<string, string[]>();
  for (const r of ctRows ?? []) {
    const list = turmasByCoreo.get(r.coreografia_id) ?? [];
    list.push(classMap.get(r.turma_id) ?? "");
    turmasByCoreo.set(r.coreografia_id, list);
  }
  const profsByCoreo = new Map<string, string[]>();
  for (const r of cpRows ?? []) {
    const list = profsByCoreo.get(r.coreografia_id) ?? [];
    list.push(staffMap.get(r.professor_id) ?? "");
    profsByCoreo.set(r.coreografia_id, list);
  }

  const turmaOptions = (classes ?? []).map((c) => ({ id: c.id as string, nome: c.name as string }));
  const professorOptions = (staff ?? []).map((s) => ({ id: s.id as string, nome: getStaffDisplayName(s) }));
  const alunoOptions = (students ?? []).map((s) => ({ id: s.id as string, nome: s.full_name as string }));

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title={espetaculo.nome as string}
          description={
            ((espetaculo.temporada as string | null) ?? "") +
            (espetaculo.data_evento
              ? ` · ${(espetaculo.data_evento as string).split("-").reverse().join("/")}`
              : "")
          }
        />
        <div className="flex gap-2">
          <Link
            href="/espetaculos"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Voltar
          </Link>
          <OpenInPinaButton espetaculoId={espetaculo.id as string} pinaUrl={PINA_APP_URL} />
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">Coreografias</h2>
        </div>
        <ul className="divide-y divide-border">
          {(coreografias ?? []).length > 0 ? (
            (coreografias ?? []).map((c) => {
              const cid = c.id as string;
              return (
                <li key={cid} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">
                        <span className="mr-2 text-muted-foreground">{(c.ordem as number) ?? 0}.</span>
                        {c.nome as string}
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {TIPO_LABEL[c.tipo as string] ?? c.tipo}
                        </span>
                      </p>
                      {c.musica_texto ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">🎵 {c.musica_texto as string}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Turmas: {(turmasByCoreo.get(cid) ?? []).join(", ") || "—"} · Professores:{" "}
                        {(profsByCoreo.get(cid) ?? []).join(", ") || "—"}
                      </p>
                    </div>
                    <DeleteCoreografiaButton espetaculoId={id} coreografiaId={cid} />
                  </div>
                </li>
              );
            })
          ) : (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhuma coreografia ainda. Adicione abaixo.
            </li>
          )}
        </ul>
      </section>

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">Nova coreografia</h2>
        <div className="mt-3">
          <CoreografiaForm
            espetaculoId={id}
            turmas={turmaOptions}
            professores={professorOptions}
            alunos={alunoOptions}
          />
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Personagens
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {(personagens ?? []).length}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Papéis deste espetáculo (Morticia, Wandinha…). Cor = identidade visual no palco. O Pina consome esta lista.
          </p>
        </div>
        {(personagens ?? []).length > 0 ? (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {((personagens ?? []) as PersonagemItem[]).map((p) => (
                <PersonagemRow
                  key={p.id}
                  espetaculoId={id}
                  personagem={p}
                  alunos={alunoOptions}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">
            Nenhum personagem ainda. Adicione abaixo.
          </p>
        )}
        <div className="border-t border-border p-5">
          <PersonagemCreate espetaculoId={id} alunos={alunoOptions} />
        </div>
      </section>
    </div>
  );
}
