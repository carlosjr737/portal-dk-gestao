import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TeacherAvatar } from "@/features/staff/teacher-avatar";
import { teacherDnaPillars } from "@/features/teacher-dna/constants";
import { TeacherDnaAssessmentHistory } from "@/features/teacher-dna/components/teacher-dna-assessment-history";
import { TeacherDnaEvolution } from "@/features/teacher-dna/components/teacher-dna-evolution";
import { TeacherDnaPillarBars } from "@/features/teacher-dna/components/teacher-dna-pillar-bars";
import {
  formatScore,
  getPerformanceLabel,
} from "@/features/teacher-dna/scoring";
import {
  getTeacherDnaDetailData,
  getTeacherDnaQuery,
  getTeacherName,
  normalizeTeacherDnaFilters,
} from "@/features/teacher-dna/queries";
import type { TeacherDnaTeacherScore } from "@/features/teacher-dna/types";

export const dynamic = "force-dynamic";

type TeacherDnaDetailPageProps = {
  params: Promise<{ teacherId: string }>;
  searchParams?: Promise<{
    period?: string;
    modalityId?: string;
    levelId?: string;
    status?: string;
  }>;
};

export default async function TeacherDnaDetailPage({
  params,
  searchParams,
}: TeacherDnaDetailPageProps) {
  const { teacherId } = await params;
  const filters = normalizeTeacherDnaFilters({
    ...(await searchParams),
    teacherId,
  });
  const data = await getTeacherDnaDetailData(teacherId, filters);

  if (!data.teacherScore) {
    notFound();
  }

  const score = data.teacherScore;
  const teacherName = getTeacherName(score.teacher);
  const strengths = getTopPillars(score, "best");
  const improvements = getTopPillars(score, "attention");

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/dna-professores?${getTeacherDnaQuery(filters)}`}
          className="text-sm font-medium text-primary"
        >
          Voltar para DNA do Professor
        </Link>
      </div>

      <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <TeacherAvatar
            name={teacherName}
            photoPath={score.teacher.photo_path}
            size="xl"
          />
          <div className="min-w-0 flex-1">
            <PageHeader
              title={teacherName}
              description="Detalhe da pontuação do professor nos 12 pilares do padrão DK."
            />
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 md:min-w-[360px]">
            <MiniMetric label="Pontuação geral" value={formatScore(score.overallScore)} />
            <MiniMetric label="Aulas avaliadas" value={String(score.evaluatedLessons)} />
            <MiniMetric
              label="Melhor pilar"
              value={score.bestPillar?.name ?? "-"}
            />
            <MiniMetric
              label="Pilar de atenção"
              value={score.attentionPillar?.name ?? "-"}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <DetailCard
          label="Pontuação geral"
          value={formatScore(score.overallScore)}
          detail={getPerformanceLabel(score.overallScore)}
        />
        <DetailCard
          label="Aulas avaliadas"
          value={String(score.evaluatedLessons)}
          detail="No período filtrado"
        />
        <DetailCard
          label="Última avaliação"
          value={formatDate(score.lastAssessmentDate)}
          detail="Data da aula"
        />
        <DetailCard
          label="Tendência"
          value={formatTrend(score.trend)}
          detail="Comparada à avaliação anterior"
        />
      </section>

      {score.evaluatedLessons === 0 ? (
        <section className="mt-6 rounded-lg border border-dashed border-border bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-semibold text-foreground">
            Nenhuma avaliação de DNA encontrada para este professor.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Assim que houver avaliações, os pontos fortes, pontos de atenção e
            histórico aparecerão nesta página.
          </p>
        </section>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <TeacherDnaPillarBars
              scores={score.pillarScores}
              title="Pontuação atual por pilar"
            />
            <section className="space-y-4">
              <PillarList title="Pontos fortes" rows={strengths} />
              <PillarList title="Pontos de atenção" rows={improvements} />
            </section>
          </div>
          <TeacherDnaEvolution rows={data.monthlyEvolution} />
          <TeacherDnaAssessmentHistory
            teacherName={teacherName}
            assessments={score.assessments}
          />
          <AiNotes score={score} />
        </div>
      )}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 line-clamp-2 font-bold text-foreground">{value}</p>
    </div>
  );
}

function DetailCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function PillarList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ name: string; score: number }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm"
          >
            <span className="font-medium text-foreground">{row.name}</span>
            <span className="font-bold text-primary">{row.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiNotes({
  score,
}: {
  score: TeacherDnaTeacherScore;
}) {
  const latestWithSummary = score.assessments.find(
    (assessment) =>
      assessment.summary ||
      assessment.strengths?.length ||
      assessment.improvements?.length,
  );

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">
        Observações da IA
      </h2>
      {latestWithSummary ? (
        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
          {latestWithSummary.summary ? <p>{latestWithSummary.summary}</p> : null}
          {latestWithSummary.strengths?.length ? (
            <p>
              <strong className="text-foreground">Pontos fortes:</strong>{" "}
              {latestWithSummary.strengths.join(", ")}
            </p>
          ) : null}
          {latestWithSummary.improvements?.length ? (
            <p>
              <strong className="text-foreground">Recomendações:</strong>{" "}
              {latestWithSummary.improvements.join(", ")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma observação textual vinculada às avaliações deste período.
        </p>
      )}
    </section>
  );
}

function getTopPillars(
  score: TeacherDnaTeacherScore,
  mode: "best" | "attention",
): Array<{ name: string; score: number }> {
  return teacherDnaPillars
    .reduce<Array<{ name: string; score: number }>>((rows, pillar) => {
      const pillarScore = score.pillarScores[pillar.key];

      if (typeof pillarScore === "number") {
        rows.push({
          name: pillar.name,
          score: pillarScore,
        });
      }

      return rows;
    }, [])
    .sort((a, b) => (mode === "best" ? b.score - a.score : a.score - b.score))
    .slice(0, 3);
}

function formatTrend(trend: "up" | "down" | "stable" | "none") {
  return {
    up: "Subindo",
    down: "Caindo",
    stable: "Estável",
    none: "-",
  }[trend];
}

function formatDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${date}T12:00:00`));
}
