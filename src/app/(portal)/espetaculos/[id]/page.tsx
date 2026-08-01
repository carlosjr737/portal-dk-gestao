import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";
import { getStaffDisplayName } from "@/features/staff/formatters";
import { CoreografiaForm } from "@/features/espetaculo/coreografia-form";
import { CoreografiaEditor } from "@/features/espetaculo/coreografia-editor";
import type { CoreografiaTipo } from "@/features/espetaculo/schemas";
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

  const supabase = await createClient();
  const { data: espetaculo } = await supabase
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
    supabase
      .from("coreografia")
      .select("id, nome, tipo, musica_texto, audio_url, ordem, duracao_segundos")
      .eq("espetaculo_id", id)
      .order("ordem", { ascending: true }),
    supabase.from("classes").select("id, name").eq("status", "active").order("name"),
    supabase.from("staff_members").select("id, full_name, artistic_name").eq("role", "professor").order("full_name"),
    supabase.from("students").select("id, full_name").eq("status", "active").order("full_name"),
    supabase
      .from("personagem")
      .select("id, nome, cor, aluno_id")
      .eq("espetaculo_id", id)
      .order("nome", { ascending: true }),
  ]);

  const coreoIds = (coreografias ?? []).map((c) => c.id as string);
  const [{ data: ctRows }, { data: cpRows }, { data: caRows }] = await Promise.all([
    coreoIds.length
      ? supabase.from("coreografia_turma").select("coreografia_id, turma_id").in("coreografia_id", coreoIds)
      : Promise.resolve({ data: [] as { coreografia_id: string; turma_id: string }[] }),
    coreoIds.length
      ? supabase.from("coreografia_professor").select("coreografia_id, professor_id").in("coreografia_id", coreoIds)
      : Promise.resolve({ data: [] as { coreografia_id: string; professor_id: string }[] }),
    coreoIds.length
      ? supabase.from("coreografia_aluno").select("coreografia_id, aluno_id").in("coreografia_id", coreoIds)
      : Promise.resolve({ data: [] as { coreografia_id: string; aluno_id: string }[] }),
  ]);

  const classMap = new Map((classes ?? []).map((c) => [c.id as string, c.name as string]));
  const staffMap = new Map(
    (staff ?? []).map((s) => [s.id as string, getStaffDisplayName(s)]),
  );
  // IDs vinculados por coreografia (pra pré-marcar na edição).
  const turmaIdsByCoreo = new Map<string, string[]>();
  const profIdsByCoreo = new Map<string, string[]>();
  const alunoIdsByCoreo = new Map<string, string[]>();
  for (const r of ctRows ?? []) {
    const list = turmaIdsByCoreo.get(r.coreografia_id) ?? [];
    list.push(r.turma_id);
    turmaIdsByCoreo.set(r.coreografia_id, list);
  }
  for (const r of cpRows ?? []) {
    const list = profIdsByCoreo.get(r.coreografia_id) ?? [];
    list.push(r.professor_id);
    profIdsByCoreo.set(r.coreografia_id, list);
  }
  for (const r of caRows ?? []) {
    const list = alunoIdsByCoreo.get(r.coreografia_id) ?? [];
    list.push(r.aluno_id);
    alunoIdsByCoreo.set(r.coreografia_id, list);
  }
  // Nomes por coreografia (pra exibir o resumo).
  const turmasByCoreo = new Map<string, string[]>();
  for (const [cid, ids] of turmaIdsByCoreo) {
    turmasByCoreo.set(cid, ids.map((tid) => classMap.get(tid) ?? ""));
  }
  const profsByCoreo = new Map<string, string[]>();
  for (const [cid, ids] of profIdsByCoreo) {
    profsByCoreo.set(cid, ids.map((pid) => staffMap.get(pid) ?? ""));
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
                <CoreografiaEditor
                  key={cid}
                  espetaculoId={id}
                  resumo={{
                    ordem: (c.ordem as number) ?? 0,
                    nome: c.nome as string,
                    tipoLabel: TIPO_LABEL[c.tipo as string] ?? (c.tipo as string),
                    musicaTexto: (c.musica_texto as string | null) ?? null,
                    turmasStr: (turmasByCoreo.get(cid) ?? []).join(", "),
                    professoresStr: (profsByCoreo.get(cid) ?? []).join(", "),
                  }}
                  defaults={{
                    coreografiaId: cid,
                    nome: c.nome as string,
                    tipo: c.tipo as CoreografiaTipo,
                    musica_texto: (c.musica_texto as string | null) ?? "",
                    audio_url: (c.audio_url as string | null) ?? "",
                    ordem: (c.ordem as number) ?? 0,
                    duracao_segundos: (c.duracao_segundos as number | null) ?? null,
                    turmaIds: turmaIdsByCoreo.get(cid) ?? [],
                    professorIds: profIdsByCoreo.get(cid) ?? [],
                    alunoIds: alunoIdsByCoreo.get(cid) ?? [],
                  }}
                  turmas={turmaOptions}
                  professores={professorOptions}
                  alunos={alunoOptions}
                />
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

      <section className="mt-6 rounded-md border border-border bg-white">
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
