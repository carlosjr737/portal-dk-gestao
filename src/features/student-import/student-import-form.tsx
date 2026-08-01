"use client";

import { useActionState } from "react";
import { importStudentsAction } from "@/features/student-import/actions";
import type {
  StudentImportReportRow,
  StudentImportState,
  StudentImportSummary,
} from "@/features/student-import/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field as FormField } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const initialState: StudentImportState = {
  status: "ready",
};

const summaryLabels: Array<[keyof StudentImportSummary, string]> = [
  ["totalRows", "Total de linhas"],
  ["newStudents", "Alunos novos"],
  ["existingStudents", "Alunos existentes"],
  ["newGuardians", "Responsáveis novos"],
  ["existingGuardians", "Responsáveis existentes"],
  ["newLinks", "Vínculos novos"],
  ["newEnrollments", "Matrículas novas"],
  ["existingEnrollments", "Matrículas existentes"],
  ["studentsWithoutFinancialGuardian", "Alunos sem responsável financeiro"],
  ["classesNotFound", "Turmas não encontradas"],
  ["ambiguousClasses", "Turmas ambíguas"],
  ["cpfConflicts", "Conflitos de CPF"],
  ["errors", "Linhas com erro"],
];

export function StudentImportForm() {
  const [state, formAction, isPending] = useActionState(
    importStudentsAction,
    initialState,
  );

  return (
    <div className="mt-6 space-y-6">
      <form action={formAction} className="rounded-md border border-border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="block lg:col-span-2">
            <span className="text-sm font-medium text-foreground">
              Planilha de alunos
            </span>
            <Input
              name="spreadsheet"
              type="file"
              accept=".xls,.xlsx,.csv"
              className="mt-1 block py-2"
            />
          </label>
          <Field
            label="Data de início padrão"
            name="start_date"
            type="date"
            defaultValue={state.defaults?.startDate ?? ""}
            required
          />
          <Field
            label="Data final padrão"
            name="end_date"
            type="date"
            defaultValue={state.defaults?.endDate ?? ""}
            required
          />
          <Field
            label="Valor mensal padrão"
            name="monthly_amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              state.defaults?.monthlyAmount === null ||
              state.defaults?.monthlyAmount === undefined
                ? ""
                : String(state.defaults.monthlyAmount)
            }
          />
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Status padrão
            </span>
            <Select
              name="status"
              defaultValue={state.defaults?.status ?? "active"}
              className="mt-1"
            >
              <option value="active">Ativa</option>
              <option value="paused">Pausada</option>
              <option value="evaluation">Em avaliação</option>
            </Select>
          </label>
        </div>

        {state.message ? (
          <div
            className={
              state.status === "error"
                ? "mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                : "mt-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground"
            }
          >
            {state.message}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
          <Button
            variant="secondary"
            type="submit"
            name="intent"
            value="analyze"
            disabled={isPending}
          >
            {isPending ? "Analisando..." : "Analisar planilha"}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="confirm"
            disabled={isPending || !state.rows?.length}
          >
            {isPending ? "Importando..." : "Confirmar importação"}
          </Button>
        </div>
      </form>

      {state.summary ? <Summary summary={state.summary} /> : null}
      {state.reportRows?.length ? <Report rows={state.reportRows} /> : null}
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type: string;
  min?: string;
  step?: string;
  defaultValue?: string;
  required?: boolean;
};

function Field({
  label,
  name,
  type,
  min,
  step,
  defaultValue,
  required,
}: FieldProps) {
  return (
    <FormField label={label} required={required}>
      <Input
        name={name}
        type={type}
        min={min}
        step={step}
        defaultValue={defaultValue}
        required={required}
      />
    </FormField>
  );
}

function Summary({ summary }: { summary: StudentImportSummary }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-foreground">
        Resumo do processamento
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryLabels.map(([key, label]) => (
          <div key={key} className="rounded-md border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {summary[key]}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Report({ rows }: { rows: StudentImportReportRow[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-white">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Relatório da importação
        </h2>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => downloadReport(rows)}
        >
          Baixar CSV do relatório
        </Button>
      </div>
      <Table containerClassName="rounded-none border-0" minWidth="920px">
        <TableHeader>
          <TableRow>
            <TableHead>Linha</TableHead>
            <TableHead>Aluno</TableHead>
            <TableHead>Turma</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Avisos</TableHead>
            <TableHead>Erros</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.slice(0, 80).map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell className="text-muted-foreground">
                  {row.rowNumber}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {row.studentName || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.classText || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.action}</TableCell>
                <TableCell className="text-amber-700">
                  {row.warnings.join(" | ") || "-"}
                </TableCell>
                <TableCell className="text-red-700">
                  {row.errors.join(" | ") || "-"}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={6}>Nenhuma linha no relatório.</TableEmpty>
          )}
        </TableBody>
      </Table>
      {rows.length > 80 ? (
        <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
          Mostrando as primeiras 80 linhas. Baixe o CSV para ver o relatório
          completo.
        </p>
      ) : null}
    </section>
  );
}

function downloadReport(rows: StudentImportReportRow[]) {
  const header = ["linha", "aluno", "turma", "acao", "avisos", "erros"];
  const csvRows = rows.map((row) =>
    [
      row.rowNumber,
      row.studentName,
      row.classText,
      row.action,
      row.warnings.join(" | "),
      row.errors.join(" | "),
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...csvRows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "relatorio-importacao-alunos.csv";
  link.click();
  URL.revokeObjectURL(url);
}
