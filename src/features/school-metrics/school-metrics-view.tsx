"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatScore } from "@/features/teacher-dna/scoring";
import type {
  SchoolClassRevenueMetric,
  SchoolGroupMetric,
  SchoolMetrics,
  SchoolTeacherMetric,
} from "@/features/school-metrics/queries";
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

export function SchoolMetricsView({ metrics }: { metrics: SchoolMetrics }) {
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
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <MetricCard label="Alunos ativos" value={String(metrics.activeStudents)} />
        <MetricCard
          label="Matrículas ativas"
          value={String(metrics.activeEnrollments)}
        />
        <MetricCard label="Turmas ativas" value={String(metrics.activeClasses)} />
        <MetricCard
          label="Professores ativos"
          value={String(metrics.teachersActive)}
        />
        <MetricCard
          label="Receita mensal (MRR líquido)"
          value={formatCurrencyBRL(metrics.monthlyRevenue)}
          detail="Mensalidade menos descontos · matrículas ativas"
        />
        <MetricCard
          label="Receita bruta contratada"
          value={formatCurrencyBRL(metrics.grossRevenue)}
          detail="Mensalidade cheia · sem aplicar descontos"
        />
        <MetricCard
          label="Descontos concedidos"
          value={formatCurrencyBRL(metrics.totalDiscount)}
          detail="Bolsas e descontos das matrículas ativas"
        />
        <MetricCard
          label="Ticket médio por matrícula"
          value={
            metrics.averageTicketPerEnrollment !== null
              ? formatCurrencyBRL(metrics.averageTicketPerEnrollment)
              : "-"
          }
          detail={`${metrics.activeEnrollments} matrículas ativas`}
        />
        <MetricCard
          label="Ticket médio por aluno"
          value={
            metrics.averageTicketPerStudent !== null
              ? formatCurrencyBRL(metrics.averageTicketPerStudent)
              : "-"
          }
          detail={`${metrics.activeStudents} alunos distintos`}
        />
        <MetricCard
          label="Ocupação"
          value={formatPercent(metrics.occupancyRate)}
          detail={
            metrics.totalCapacity > 0
              ? `${metrics.activeEnrollments}/${metrics.totalCapacity} vagas`
              : "Sem capacidade definida"
          }
        />
      </div>

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
  const enrollmentsWithoutAmount = filteredRows.reduce(
    (sum, row) => sum + row.enrollmentsWithoutAmount,
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

      {showRevenueDifferenceAlert ? (
        <Alert tone="warning" className="p-4 font-medium">
          Atenção: há diferença entre a receita geral e a soma por turma.
          Verifique matrículas sem turma, duplicadas ou valores inconsistentes.
        </Alert>
      ) : null}

      {enrollmentsWithoutAmount > 0 ? (
        <Alert tone="warning" className="p-4 font-medium">
          Existem {enrollmentsWithoutAmount} matrículas ativas sem valor mensal
          cadastrado. Isso pode distorcer o faturamento por turma.
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Receita mensal líquida por turma"
          value={formatCurrencyBRL(monthlyRevenue)}
          detail="MRR líquido nas turmas filtradas"
        />
        <MetricCard
          label="Maior faturamento"
          value={
            highestRevenueClass
              ? formatCurrencyBRL(highestRevenueClass.monthlyRevenue)
              : "-"
          }
          detail={highestRevenueClass?.className ?? "Sem turma com alunos"}
        />
        <MetricCard
          label="Menor faturamento"
          value={
            lowestRevenueClass
              ? formatCurrencyBRL(lowestRevenueClass.monthlyRevenue)
              : "-"
          }
          detail={lowestRevenueClass?.className ?? "Sem turma com alunos"}
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

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {detail ? (
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
