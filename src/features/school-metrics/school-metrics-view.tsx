"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { formatScore } from "@/features/teacher-dna/scoring";
import type {
  SchoolClassRevenueMetric,
  SchoolGroupMetric,
  SchoolMetrics,
  SchoolTeacherMetric,
} from "@/features/school-metrics/queries";
import type { MonthlyBasePoint } from "@/features/school-metrics/monthly-base";
import {
  discountShare,
  enrollmentsPerStudent,
  idleCapacity,
  studentsDelta,
  studentsPerClass,
} from "@/features/school-metrics/derived";
import { MetricCard } from "@/components/ui/metric-card";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrencyBRL(value: number) {
  return currencyFormatter.format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}

function formatPercentValue(value: number | null) {
  return value === null ? null : Number((value * 100).toFixed(2));
}

const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatDecimal(value: number) {
  return decimalFormatter.format(value);
}

/** Percentual com uma casa: 11,3% diz mais que 11% num número de desconto. */
function formatPercentDecimal(value: number) {
  return `${decimalFormatter.format(value * 100)}%`;
}

type SortKey = "revenue" | "students" | "ticket" | "name";

/**
 * Coluna com um valor só não é coluna: ela ocupa largura para não informar
 * nada. `Sem valor` zerado em todas as linhas e `Status` quando o filtro já
 * fixou um status caem os dois nesta regra.
 */
function hasMoreThanOneValue<Row, Value>(
  rows: Row[],
  pick: (row: Row) => Value,
) {
  if (rows.length < 2) {
    return false;
  }

  const first = pick(rows[0]);
  return rows.some((row) => pick(row) !== first);
}

const statusLabels = new Map([
  ["active", "Ativa"],
  ["inactive", "Inativa"],
  ["planning", "Planejamento"],
]);

export function SchoolMetricsView({
  metrics,
  monthlyBase,
}: {
  metrics: SchoolMetrics;
  monthlyBase?: MonthlyBasePoint[];
}) {
  if (!metrics.available) {
    return (
      <Alert tone="warning" className="p-4">
        Não foi possível carregar as métricas da escola agora. Tente novamente em
        instantes.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <SchoolKpis metrics={metrics} monthlyBase={monthlyBase} />

      <div className="grid gap-4 xl:grid-cols-2">
        <GroupTable
          title="Receita por modalidade"
          firstColumn="Modalidade"
          rows={metrics.perModality}
          totalRevenue={metrics.monthlyRevenue}
          totalEnrollments={metrics.activeEnrollments}
        />
        <GroupTable
          title="Receita por nível"
          firstColumn="Nível"
          rows={metrics.perLevel}
          totalRevenue={metrics.monthlyRevenue}
          totalEnrollments={metrics.activeEnrollments}
        />
      </div>

      <TeacherTable
        rows={metrics.perTeacher}
        totalRevenue={metrics.monthlyRevenue}
        totalEnrollments={metrics.activeEnrollments}
      />

      <ClassRevenueSection metrics={metrics} />
    </div>
  );
}

/**
 * Verificações de qualidade de dado, e só quando existem.
 *
 * Antes eram três cartões marcando "0" numa linha inteira da tela, todo dia,
 * mais dois alertas soltos. Quando um deles virasse 3, ninguém notaria —
 * a posição já era território de ruído. Nada disso é indicador de gestão:
 * importa apenas quando não é zero.
 */
function DataQualityBanner({
  diagnostics,
  showRevenueDifference,
}: {
  diagnostics: SchoolMetrics["revenueDiagnostics"];
  showRevenueDifference: boolean;
}) {
  const items: ReactNode[] = [];

  if (diagnostics.activeEnrollmentsWithoutClass > 0) {
    items.push(
      <>
        <strong className="font-semibold tabular-nums">
          {diagnostics.activeEnrollmentsWithoutClass}
        </strong>{" "}
        matrículas ativas sem turma válida —{" "}
        <Link className="underline hover:no-underline" href="/matriculas">
          ver matrículas
        </Link>
      </>,
    );
  }

  // Nulas e zeradas ficam em linhas separadas de propósito: as duas contagens
  // de queries.ts se sobrepõem (toda nula também conta como zerada), então
  // somar as duas inflaria o número. Separadas, cada uma é exata.
  if (diagnostics.activeEnrollmentsWithoutAmount > 0) {
    items.push(
      <>
        <strong className="font-semibold tabular-nums">
          {diagnostics.activeEnrollmentsWithoutAmount}
        </strong>{" "}
        matrículas ativas sem mensalidade cadastrada —{" "}
        <Link className="underline hover:no-underline" href="/matriculas">
          ver matrículas
        </Link>
      </>,
    );
  }

  if (diagnostics.activeEnrollmentsWithZeroAmount > 0) {
    items.push(
      <>
        <strong className="font-semibold tabular-nums">
          {diagnostics.activeEnrollmentsWithZeroAmount}
        </strong>{" "}
        matrículas ativas com mensalidade zerada —{" "}
        <Link className="underline hover:no-underline" href="/matriculas">
          ver matrículas
        </Link>
      </>,
    );
  }

  if (diagnostics.zeroRevenueClassesWithActiveEnrollments > 0) {
    items.push(
      <>
        <strong className="font-semibold tabular-nums">
          {diagnostics.zeroRevenueClassesWithActiveEnrollments}
        </strong>{" "}
        turmas com matrícula ativa e receita zero —{" "}
        <Link className="underline hover:no-underline" href="/turmas">
          ver turmas
        </Link>
      </>,
    );
  }

  if (showRevenueDifference) {
    items.push(
      <>
        A receita geral não bate com a soma por turma. Verifique matrículas
        duplicadas ou valores inconsistentes.
      </>,
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Alert tone="warning" className="p-4">
      <div>
        <p className="font-semibold">Verificar cadastro</p>
        <ul className="mt-1 space-y-1">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </Alert>
  );
}

/**
 * Os quatro indicadores que decidem alguma coisa, mais uma faixa com os
 * derivados de conferência.
 *
 * Onze cartões de mesmo peso não têm hierarquia: eram três linhas de cartão
 * antes de qualquer conteúdo, e vários deles eram o mesmo dado escrito de
 * outro jeito (bruta − descontos = líquida gastava três cartões para exibir
 * uma subtração).
 */
function SchoolKpis({
  metrics,
  monthlyBase,
}: {
  metrics: SchoolMetrics;
  monthlyBase?: MonthlyBasePoint[];
}) {
  const perStudent = enrollmentsPerStudent(metrics);
  const perClass = studentsPerClass(metrics);
  const discount = discountShare(metrics);
  const idle = idleCapacity(metrics);
  const delta = studentsDelta(monthlyBase);

  // Sem capacidade cadastrada, formatPercent devolveria "–" e o cartão
  // passaria o dia dizendo que não sabe. Melhor não existir.
  const showOccupancy = metrics.occupancyRate !== null;

  const derived = [
    `${metrics.activeEnrollments} matrículas ativas`,
    `${metrics.teachersActive} professores ativos`,
    `Receita bruta ${formatCurrencyBRL(metrics.grossRevenue)}`,
    `Descontos ${formatCurrencyBRL(metrics.totalDiscount)}`,
    metrics.averageTicketPerEnrollment !== null
      ? `Ticket/matrícula ${formatCurrencyBRL(metrics.averageTicketPerEnrollment)}`
      : null,
    metrics.averageTicketPerStudent !== null
      ? `Ticket/aluno ${formatCurrencyBRL(metrics.averageTicketPerStudent)}`
      : null,
  ].filter((item): item is string => item !== null);

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Alunos ativos"
          value={String(metrics.activeStudents)}
          href="/alunos"
          delta={
            delta === null
              ? undefined
              : { value: delta, kind: "absolute", hint: "vs. mês anterior" }
          }
          hint={
            perStudent === null
              ? undefined
              : `${formatDecimal(perStudent)} matrículas por aluno`
          }
        />

        <MetricCard
          label="Receita mensal"
          value={formatCurrencyBRL(metrics.monthlyRevenue)}
          href="/financeiro/faturamento-turmas"
          hint={
            discount === null
              ? "Mensalidade menos descontos"
              : `${formatPercentDecimal(discount)} de desconto sobre a bruta`
          }
        />

        {showOccupancy ? (
          <MetricCard
            label="Ocupação"
            value={formatPercent(metrics.occupancyRate)}
            href="/turmas"
            hint={
              idle === null
                ? `${metrics.activeEnrollments} matrículas`
                : idle.amount === null
                  ? `${idle.seats} vagas ociosas`
                  : `${idle.seats} vagas ociosas · ${formatCurrencyBRL(idle.amount)} de capacidade não vendida`
            }
          >
            <OccupancyBar rate={metrics.occupancyRate} />
          </MetricCard>
        ) : null}

        <MetricCard
          label="Turmas ativas"
          value={String(metrics.activeClasses)}
          href="/turmas"
          hint={
            perClass === null
              ? `${metrics.teachersActive} professores`
              : `${formatDecimal(perClass)} alunos por turma · ${metrics.teachersActive} professores`
          }
        />
      </div>

      <p className="text-[13px] text-muted-foreground">
        {derived.map((item, index) => (
          <span key={item}>
            {index > 0 ? <span aria-hidden="true"> · </span> : null}
            <span className="tabular-nums">{item}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * Ocupação é o único dos quatro com barra: é o número que aponta dinheiro
 * parado, e o peso gráfico é o que o coloca à frente sem quebrar a grade.
 */
function OccupancyBar({ rate }: { rate: number | null }) {
  if (rate === null) {
    return null;
  }

  const width = Math.min(100, Math.max(0, rate * 100));

  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function ClassRevenueSection({ metrics }: { metrics: SchoolMetrics }) {
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [modalityFilter, setModalityFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");

  const filteredRows = useMemo(() => {
    return metrics.classRevenue
      .filter((row) => statusFilter === "all" || row.classStatus === "active")
      .filter((row) => teacherFilter === "all" || row.teacherId === teacherFilter)
      .filter(
        (row) => modalityFilter === "all" || row.modalityId === modalityFilter,
      )
      .filter((row) => levelFilter === "all" || row.levelId === levelFilter)
      .sort((a, b) => compareClassRevenueRows(a, b, sortKey));
  }, [
    levelFilter,
    metrics.classRevenue,
    modalityFilter,
    sortKey,
    statusFilter,
    teacherFilter,
  ]);

  const activeRows = filteredRows.filter((row) => row.activeEnrollments > 0);
  const monthlyRevenue = filteredRows.reduce(
    (sum, row) => sum + row.monthlyRevenue,
    0,
  );
  const highestRevenueClass = activeRows.reduce<SchoolClassRevenueMetric | null>(
    (current, row) =>
      !current || row.monthlyRevenue > current.monthlyRevenue ? row : current,
    null,
  );
  const lowestRevenueClass = activeRows.reduce<SchoolClassRevenueMetric | null>(
    (current, row) =>
      !current || row.monthlyRevenue < current.monthlyRevenue ? row : current,
    null,
  );
  const topClasses = [...filteredRows]
    .filter((row) => row.monthlyRevenue > 0)
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
    .slice(0, 10);
  const maxRevenue = topClasses[0]?.monthlyRevenue ?? 0;
  const hasClasses = filteredRows.length > 0;
  const hasActiveEnrollments = activeRows.length > 0;
  const hasRevenue = monthlyRevenue > 0;
  const showRevenueDifferenceAlert =
    Math.abs(metrics.revenueDiagnostics.revenueDifference) > 1;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Faturamento por Turma
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Receita mensal líquida (mensalidade menos descontos) das matrículas
          ativas do sistema.
        </p>
      </div>

      <DataQualityBanner
        diagnostics={metrics.revenueDiagnostics}
        showRevenueDifference={showRevenueDifferenceAlert}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Receita mensal líquida"
          value={formatCurrencyBRL(monthlyRevenue)}
          hint={`${filteredRows.length} ${filteredRows.length === 1 ? "turma" : "turmas"} no filtro atual`}
        />
        <MetricCard
          label="Maior faturamento"
          value={
            highestRevenueClass
              ? formatCurrencyBRL(highestRevenueClass.monthlyRevenue)
              : "-"
          }
          href={
            highestRevenueClass
              ? `/turmas/${highestRevenueClass.classId}`
              : undefined
          }
          hint={
            <span className="block truncate" title={highestRevenueClass?.className}>
              {highestRevenueClass?.className ?? "Sem turma com alunos"}
            </span>
          }
        />
        <MetricCard
          label="Menor faturamento"
          value={
            lowestRevenueClass
              ? formatCurrencyBRL(lowestRevenueClass.monthlyRevenue)
              : "-"
          }
          href={
            lowestRevenueClass
              ? `/turmas/${lowestRevenueClass.classId}`
              : undefined
          }
          hint={
            <span className="block truncate" title={lowestRevenueClass?.className}>
              {lowestRevenueClass?.className ?? "Sem turma com alunos"}
            </span>
          }
        />
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
        <FilterSelect
          label="Status da turma"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as "active" | "all")}
          options={[
            { id: "active", name: "Ativa" },
            { id: "all", name: "Todas" },
          ]}
        />
        <FilterSelect
          label="Professor"
          value={teacherFilter}
          onChange={setTeacherFilter}
          options={metrics.filters.teachers}
          allLabel="Todos"
        />
        <FilterSelect
          label="Modalidade"
          value={modalityFilter}
          onChange={setModalityFilter}
          options={metrics.filters.modalities}
          allLabel="Todas"
        />
        <FilterSelect
          label="Nível"
          value={levelFilter}
          onChange={setLevelFilter}
          options={metrics.filters.levels}
          allLabel="Todos"
        />
        <FilterSelect
          label="Ordenar por"
          value={sortKey}
          onChange={(value) => setSortKey(value as SortKey)}
          options={[
            { id: "revenue", name: "Maior faturamento" },
            { id: "students", name: "Matrículas ativas" },
            { id: "ticket", name: "Ticket por matrícula" },
            { id: "name", name: "Nome da turma" },
          ]}
          includeAll={false}
        />
      </div>

      {!hasClasses ? (
        <div className="rounded-lg border border-border bg-white p-6 text-center text-sm text-muted-foreground shadow-sm">
          Nenhuma turma com matrícula ativa encontrada.
        </div>
      ) : !hasRevenue && hasActiveEnrollments ? (
        <Alert tone="warning" className="p-4 font-medium">
          As turmas existem, mas não há valores mensais cadastrados nas
          matrículas.
        </Alert>
      ) : null}

      {topClasses.length > 0 ? (
        <TopClassRevenueChart rows={topClasses} maxRevenue={maxRevenue} />
      ) : null}

      <ClassRevenueTable rows={filteredRows} totalRevenue={monthlyRevenue} />
    </section>
  );
}

function compareClassRevenueRows(
  a: SchoolClassRevenueMetric,
  b: SchoolClassRevenueMetric,
  sortKey: SortKey,
) {
  if (sortKey === "students") {
    return (
      b.activeEnrollments - a.activeEnrollments ||
      b.monthlyRevenue - a.monthlyRevenue
    );
  }

  if (sortKey === "ticket") {
    return (
      b.averageTicketPerEnrollment - a.averageTicketPerEnrollment ||
      b.monthlyRevenue - a.monthlyRevenue
    );
  }

  if (sortKey === "name") {
    return a.className.localeCompare(b.className, "pt-BR");
  }

  return (
    b.monthlyRevenue - a.monthlyRevenue ||
    b.activeEnrollments - a.activeEnrollments
  );
}

function TopClassRevenueChart({
  rows,
  maxRevenue,
}: {
  rows: SchoolClassRevenueMetric[];
  maxRevenue: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Top 10 turmas por receita mensal líquida
        </h3>
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const width =
            maxRevenue > 0 ? (row.monthlyRevenue / maxRevenue) * 100 : 0;

          return (
            <div
              className="grid gap-2 text-sm md:grid-cols-[minmax(180px,280px)_1fr_auto]"
              key={row.classId}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {row.className}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.teacherName}
                </p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="font-semibold text-foreground">
                {formatCurrencyBRL(row.monthlyRevenue)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClassRevenueTable({
  rows,
  totalRevenue,
}: {
  rows: SchoolClassRevenueMetric[];
  totalRevenue: number;
}) {
  const showWithoutAmount = hasMoreThanOneValue(
    rows,
    (row) => row.enrollmentsWithoutAmount > 0,
  );
  const showStatus = hasMoreThanOneValue(rows, (row) => row.classStatus);
  const columnCount = 6 + Number(showWithoutAmount) + Number(showStatus);

  async function exportToExcel() {
    const XLSX = await import("xlsx");
    const totalEnrollments = rows.reduce(
      (sum, row) => sum + row.activeEnrollments,
      0,
    );
    const totalDistinctStudents = rows.reduce(
      (sum, row) => sum + row.activeStudents,
      0,
    );
    const totalWithoutAmount = rows.reduce(
      (sum, row) => sum + row.enrollmentsWithoutAmount,
      0,
    );
    const worksheetRows = rows.map((row) => ({
      Turma: row.className,
      Professor: row.teacherName,
      Modalidade: row.modalityName,
      "Nível": row.levelName,
      "Dias/horário": row.scheduleLabel,
      Status: statusLabels.get(row.classStatus) ?? row.classStatus,
      "Matrículas ativas": row.activeEnrollments,
      "Alunos distintos": row.activeStudents,
      Capacidade: row.capacity ?? "",
      "Ocupação (%)": formatPercentValue(row.occupancyRate) ?? "",
      "Receita mensal líquida": row.monthlyRevenue,
      "Ticket por matrícula": row.averageTicketPerEnrollment,
      "Matrículas sem valor": row.enrollmentsWithoutAmount,
    }));

    worksheetRows.push({
      Turma: "Total",
      Professor: "",
      Modalidade: "",
      "Nível": "",
      "Dias/horário": "",
      Status: "",
      "Matrículas ativas": totalEnrollments,
      "Alunos distintos": totalDistinctStudents,
      Capacidade: "",
      "Ocupação (%)": "",
      "Receita mensal líquida": totalRevenue,
      "Ticket por matrícula":
        totalEnrollments > 0 ? totalRevenue / totalEnrollments : 0,
      "Matrículas sem valor": totalWithoutAmount,
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
    worksheet["!cols"] = [
      { wch: 48 },
      { wch: 20 },
      { wch: 22 },
      { wch: 22 },
      { wch: 42 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 26 },
      { wch: 22 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Faturamento por Turma");
    XLSX.writeFile(workbook, "faturamento-por-turma.xlsx");
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Faturamento por turma
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ordenado conforme o filtro selecionado. A receita mensal já desconta
            os descontos cadastrados (MRR líquido).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={rows.length === 0}
          onClick={exportToExcel}
          className="bg-white font-semibold shadow-sm"
        >
          Exportar Excel
        </Button>
      </div>
      <Table containerClassName="rounded-none border-0" minWidth="980px">
        <TableHeader>
          <TableRow>
            <TableHead>Turma</TableHead>
            <TableHead>Professor</TableHead>
            <TableHead>Matrículas ativas</TableHead>
            <TableHead>Receita mensal</TableHead>
            <TableHead>Ticket por matrícula</TableHead>
            {showWithoutAmount ? <TableHead>Sem valor</TableHead> : null}
            {showStatus ? <TableHead>Status</TableHead> : null}
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => {
              const needsAttention =
                row.enrollmentsWithoutAmount > 0 ||
                (row.monthlyRevenue === 0 && row.activeEnrollments > 0);

              return (
                <TableRow
                  // O hover padrão é cinza e apagaria o âmbar de "precisa de
                  // atenção" justo na linha que o usuário está mirando.
                  className={
                    needsAttention
                      ? "bg-amber-50/60 hover:bg-amber-50/60"
                      : undefined
                  }
                  key={row.classId}
                >
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {row.className}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.modalityName} · {row.levelName}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.scheduleLabel}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Capacidade: {row.capacity ?? "-"} · Ocupação:{" "}
                      {formatPercent(row.occupancyRate)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.teacherName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>{row.activeEnrollments}</div>
                    <div className="mt-1 text-xs">
                      {row.activeStudents} alunos distintos
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {formatCurrencyBRL(row.monthlyRevenue)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCurrencyBRL(row.averageTicketPerEnrollment)}
                  </TableCell>
                  {showWithoutAmount ? (
                    <TableCell>
                      <span
                        className={
                          row.enrollmentsWithoutAmount > 0
                            ? "font-semibold text-amber-800"
                            : "text-muted-foreground"
                        }
                      >
                        {row.enrollmentsWithoutAmount}
                      </span>
                    </TableCell>
                  ) : null}
                  {showStatus ? (
                    <TableCell className="text-muted-foreground">
                      {statusLabels.get(row.classStatus) ?? row.classStatus}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Link
                      className="text-sm font-semibold text-primary hover:underline"
                      href={`/turmas/${row.classId}`}
                    >
                      Ver turma
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableEmpty colSpan={columnCount}>
              Nenhuma turma com matrícula ativa encontrada.
            </TableEmpty>
          )}
        </TableBody>
        <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold">
          <tr>
            <TableCell>Total</TableCell>
            <TableCell />
            <TableCell>
              {rows.reduce((sum, row) => sum + row.activeEnrollments, 0)}
            </TableCell>
            <TableCell>{formatCurrencyBRL(totalRevenue)}</TableCell>
            <TableCell />
            {showWithoutAmount ? (
              <TableCell>
                {rows.reduce(
                  (sum, row) => sum + row.enrollmentsWithoutAmount,
                  0,
                )}
              </TableCell>
            ) : null}
            {showStatus ? <TableCell /> : null}
            <TableCell />
          </tr>
        </tfoot>
      </Table>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "Todos",
  includeAll = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string }>;
  allLabel?: string;
  includeAll?: boolean;
}) {
  return (
    <label className="text-sm font-medium text-foreground">
      {label}
      <Select
        className="mt-1 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {includeAll ? <option value="all">{allLabel}</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

function GroupTable({
  title,
  firstColumn,
  rows,
  totalRevenue,
  totalEnrollments,
}: {
  title: string;
  firstColumn: string;
  rows: SchoolGroupMetric[];
  totalRevenue: number;
  totalEnrollments: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <Table containerClassName="rounded-none border-0" minWidth="460px">
        <TableHeader>
          <TableRow>
            <TableHead>{firstColumn}</TableHead>
            <TableHead>Turmas</TableHead>
            <TableHead>Matrículas</TableHead>
            <TableHead>Receita mensal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow key={row.id ?? "__none__"}>
                <TableCell className="font-medium text-foreground">
                  {row.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.classesCount}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.activeEnrollments}
                </TableCell>
                <TableCell className="font-semibold text-foreground">
                  {formatCurrencyBRL(row.monthlyRevenue)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={4}>Sem dados.</TableEmpty>
          )}
        </TableBody>
        <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold">
          <tr>
            <TableCell>Total</TableCell>
            <TableCell />
            <TableCell>{totalEnrollments}</TableCell>
            <TableCell>{formatCurrencyBRL(totalRevenue)}</TableCell>
          </tr>
        </tfoot>
      </Table>
    </div>
  );
}

function TeacherTable({
  rows,
  totalRevenue,
  totalEnrollments,
}: {
  rows: SchoolTeacherMetric[];
  totalRevenue: number;
  totalEnrollments: number;
}) {
  // Sem nenhuma avaliação no mês, a coluna vira uma pilha de "–". A ausência
  // de avaliação é uma frase, não uma coluna.
  const showDnaScore = rows.some((row) => row.dnaScore !== null);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Receita por professor
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {showDnaScore
            ? "Ordenado por receita mensal, com a nota de DNA do mês."
            : "Ordenado por receita mensal. Nenhum professor foi avaliado este mês."}
        </p>
      </div>
      <Table containerClassName="rounded-none border-0" minWidth="620px">
        <TableHeader>
          <TableRow>
            <TableHead>Professor</TableHead>
            <TableHead>Turmas</TableHead>
            <TableHead>Matrículas</TableHead>
            {showDnaScore ? <TableHead>Nota DNA</TableHead> : null}
            <TableHead>Receita mensal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow key={row.id ?? "__none__"}>
                <TableCell className="font-medium text-foreground">
                  {row.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.classesCount}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.activeEnrollments}
                </TableCell>
                {showDnaScore ? (
                  <TableCell className="text-muted-foreground">
                    {formatScore(row.dnaScore)}
                  </TableCell>
                ) : null}
                <TableCell className="font-semibold text-foreground">
                  {formatCurrencyBRL(row.monthlyRevenue)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={showDnaScore ? 5 : 4}>
              Sem turmas vinculadas a professores.
            </TableEmpty>
          )}
        </TableBody>
        <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold">
          <tr>
            <TableCell>Total</TableCell>
            <TableCell />
            <TableCell>{totalEnrollments}</TableCell>
            {showDnaScore ? <TableCell /> : null}
            <TableCell>{formatCurrencyBRL(totalRevenue)}</TableCell>
          </tr>
        </tfoot>
      </Table>
    </div>
  );
}

