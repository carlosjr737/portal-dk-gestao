import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  teacherDnaPeriodOptions,
  teacherDnaStatusOptions,
} from "@/features/teacher-dna/constants";
import { TeacherDnaEvolution } from "@/features/teacher-dna/components/teacher-dna-evolution";
import { TeacherDnaPillarBars } from "@/features/teacher-dna/components/teacher-dna-pillar-bars";
import { TeacherDnaPillarsHeatmap } from "@/features/teacher-dna/components/teacher-dna-pillars-heatmap";
import { TeacherDnaRankingTable } from "@/features/teacher-dna/components/teacher-dna-ranking-table";
import { TeacherDnaSummaryCards } from "@/features/teacher-dna/components/teacher-dna-summary-cards";
import { getTeacherName } from "@/features/teacher-dna/queries";
import {
  getTeacherDnaDashboardData,
  normalizeTeacherDnaFilters,
} from "@/features/teacher-dna/queries";

export const dynamic = "force-dynamic";

type DnaProfessoresPageProps = {
  searchParams?: Promise<{
    period?: string;
    teacherId?: string;
    modalityId?: string;
    levelId?: string;
    status?: string;
  }>;
};

export default async function DnaProfessoresPage({
  searchParams,
}: DnaProfessoresPageProps) {
  const params = await searchParams;
  const filters = normalizeTeacherDnaFilters(params);
  const data = await getTeacherDnaDashboardData(filters);
  const hasAssessments = data.assessedLessonsCount > 0;

  return (
    <div>
      <PageHeader
        title="DNA do Professor"
        description="Acompanhe a pontuação dos professores nos 12 pilares do padrão DK."
      />

      <section className="mt-6 rounded-lg border border-border bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Select label="Período" name="period" value={filters.period}>
            {teacherDnaPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select label="Professor" name="teacherId" value={filters.teacherId}>
            <option value="">Todos</option>
            {data.teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {getTeacherName(teacher)}
              </option>
            ))}
          </Select>
          <Select label="Modalidade" name="modalityId" value={filters.modalityId}>
            <option value="">Todas</option>
            {data.modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </Select>
          <Select label="Nível" name="levelId" value={filters.levelId}>
            <option value="">Todos</option>
            {data.levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </Select>
          <Select label="Status" name="status" value={filters.status}>
            {teacherDnaStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <div className="flex items-end gap-2">
            <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Filtrar
            </button>
            <Link
              href="/dna-professores"
              className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium"
            >
              Limpar
            </Link>
          </div>
        </form>
      </section>

      {!data.assessmentsTableAvailable ? (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A tabela de avaliações do DNA ainda não está disponível no Supabase
          remoto. Rode o SQL da migration para liberar o dashboard.
        </div>
      ) : null}

      {!hasAssessments ? (
        <EmptyState />
      ) : (
        <div className="mt-6 space-y-6">
          <TeacherDnaSummaryCards data={data} />
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <TeacherDnaRankingTable
              scores={data.teacherScores}
              filters={filters}
            />
            <TeacherDnaPillarBars scores={data.teamPillarScores} />
          </div>
          <TeacherDnaPillarsHeatmap scores={data.teacherScores} />
          <TeacherDnaEvolution rows={data.monthlyEvolution} />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-border bg-white px-6 py-12 text-center shadow-sm">
      <p className="text-base font-semibold text-foreground">
        Nenhuma avaliação de DNA encontrada para o período selecionado.
      </p>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
        Os professores cadastrados já estão disponíveis para filtro. Quando as
        avaliações forem importadas ou criadas, o ranking e a matriz dos 12
        pilares aparecerão aqui.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground">
          Importar avaliações
        </button>
        <button className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground">
          Criar avaliação manual
        </button>
        <button className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground">
          Conectar relatórios de aula
        </button>
      </div>
    </section>
  );
}

function Select({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm font-medium text-foreground">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
      >
        {children}
      </select>
    </label>
  );
}
