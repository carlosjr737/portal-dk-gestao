"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EnrollmentActionState } from "@/features/enrollments/actions";
import { enrollmentStatusOptions } from "@/features/enrollments/schemas";
import type {
  EnrollmentClassOption,
  EnrollmentGuardianOption,
  EnrollmentStudentOption,
} from "@/features/enrollments/types";
import { formatCapacity } from "@/features/classes/formatters";
import { formatText } from "@/features/students/formatters";

type EnrollmentFormProps = {
  action: (
    previousState: EnrollmentActionState,
    formData: FormData,
  ) => Promise<EnrollmentActionState>;
  students: EnrollmentStudentOption[];
  initialStudentId?: string;
  initialStudentSearch?: string;
  initialClassSearch?: string;
  classes: EnrollmentClassOption[];
  guardianLinks: EnrollmentGuardianOption[];
};

const initialState: EnrollmentActionState = {};

export function EnrollmentForm({
  action,
  students,
  initialStudentId = "",
  initialStudentSearch = "",
  initialClassSearch = "",
  classes,
  guardianLinks,
}: EnrollmentFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [studentSearch, setStudentSearch] = useState(initialStudentSearch);
  const [classSearch, setClassSearch] = useState(initialClassSearch);
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedFinancialGuardianId, setSelectedFinancialGuardianId] =
    useState("");

  const selectedStudent = students.find(
    (student) => student.id === selectedStudentId,
  );
  const selectedClass = classes.find(
    (danceClass) => danceClass.id === selectedClassId,
  );
  const selectedGuardianLinks = useMemo(
    () =>
      guardianLinks.filter((link) => link.student_id === selectedStudentId),
    [guardianLinks, selectedStudentId],
  );
  const financialGuardianLink = selectedGuardianLinks.find(
    (link) => link.is_financial_responsible,
  );

  useEffect(() => {
    setSelectedFinancialGuardianId(financialGuardianLink?.guardian_id ?? "");
  }, [financialGuardianLink?.guardian_id, selectedStudentId]);

  function updateSearchParams(next: {
    studentSearch?: string;
    classSearch?: string;
    studentId?: string;
  }) {
    const params = new URLSearchParams();
    const nextStudentId = next.studentId ?? selectedStudentId;
    const nextStudentSearch = next.studentSearch ?? studentSearch;
    const nextClassSearch = next.classSearch ?? classSearch;

    if (nextStudentId) {
      params.set("studentId", nextStudentId);
    }

    if (nextStudentSearch.trim()) {
      params.set("studentSearch", nextStudentSearch.trim());
    }

    if (nextClassSearch.trim()) {
      params.set("classSearch", nextClassSearch.trim());
    }

    router.push(`/matriculas/nova?${params.toString()}`);
  }

  return (
    <form action={formAction} className="mt-6 max-w-5xl space-y-6">
      {state.message ? (
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {state.message}
        </div>
      ) : null}

      <input type="hidden" name="student_id" value={selectedStudentId} />
      <input type="hidden" name="class_id" value={selectedClassId} />

      <section className="rounded-md border border-border bg-white p-5">
        <StepTitle number="1" title="Aluno" />
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Buscar aluno por nome, telefone ou e-mail
            </span>
            <input
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
              placeholder="Digite pelo menos parte do nome, telefone ou e-mail"
            />
          </label>
          <button
            type="button"
            onClick={() => updateSearchParams({ studentSearch })}
            className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90"
          >
            Buscar aluno
          </button>
        </div>
        {state.errors?.student_id?.[0] ? (
          <span className="mt-2 block text-xs text-red-600">
            {state.errors.student_id[0]}
          </span>
        ) : null}

        {students.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {students.map((student) => (
              <ResultRow
                key={student.id}
                selected={student.id === selectedStudentId}
                title={student.full_name}
                details={[
                  `Status: ${student.status}`,
                  `Telefone: ${formatText(student.phone)}`,
                  `E-mail: ${formatText(student.email)}`,
                  `Resp. financeiro: ${student.financialGuardianName ?? "Não informado"}`,
                  `Telefone resp.: ${student.financialGuardianPhone ?? "Não informado"}`,
                ]}
                actionLabel="Selecionar aluno"
                onSelect={() => setSelectedStudentId(student.id)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Use a busca para localizar o aluno.
          </p>
        )}

        {selectedStudent ? (
          <SelectedCard
            title={selectedStudent.full_name}
            details={[
              `Telefone: ${formatText(selectedStudent.phone)}`,
              `E-mail: ${formatText(selectedStudent.email)}`,
              `Responsável financeiro: ${
                selectedStudent.financialGuardianName ?? "Não informado"
              }`,
            ]}
          />
        ) : null}

        {selectedStudent && !financialGuardianLink ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Aluno sem responsável financeiro vinculado.
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-border bg-white p-5">
        <StepTitle number="2" title="Turma" />
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Buscar turma por nome, modalidade, nível ou professor
            </span>
            <input
              value={classSearch}
              onChange={(event) => setClassSearch(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
              placeholder="Digite nome, modalidade, nível ou professor"
            />
          </label>
          <button
            type="button"
            onClick={() => updateSearchParams({ classSearch })}
            className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90"
          >
            Buscar turma
          </button>
        </div>
        {state.errors?.class_id?.[0] ? (
          <span className="mt-2 block text-xs text-red-600">
            {state.errors.class_id[0]}
          </span>
        ) : null}

        <div className="mt-4 grid gap-3">
          {classes.map((danceClass) => (
            <ResultRow
              key={danceClass.id}
              selected={danceClass.id === selectedClassId}
              title={danceClass.name}
              details={[
                `Modalidade: ${formatText(danceClass.category)}`,
                `Nível: ${formatText(danceClass.level)}`,
                `Professor: ${danceClass.teacherName ?? "Não informado"}`,
                `Horários: ${danceClass.schedulesLabel}`,
                `Ocupação: ${danceClass.activeEnrollmentsCount} / ${formatCapacity(
                  danceClass.capacity,
                )}`,
              ]}
              actionLabel="Selecionar turma"
              onSelect={() => setSelectedClassId(danceClass.id)}
            />
          ))}
        </div>

        {selectedClass ? (
          <SelectedCard
            title={selectedClass.name}
            details={[
              `Modalidade: ${formatText(selectedClass.category)}`,
              `Nível: ${formatText(selectedClass.level)}`,
              `Professor: ${selectedClass.teacherName ?? "Não informado"}`,
              `Horários: ${selectedClass.schedulesLabel}`,
            ]}
          />
        ) : null}
      </section>

      <section className="rounded-md border border-border bg-white p-5">
        <StepTitle number="3" title="Dados da matrícula" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="Data de início"
            name="start_date"
            type="date"
            error={state.errors?.start_date?.[0]}
            required
          />
          <Field
            label="Data final"
            name="end_date"
            type="date"
            error={state.errors?.end_date?.[0]}
            required
          />
          <SelectField
            label="Status"
            name="status"
            defaultValue="active"
            options={enrollmentStatusOptions}
            error={state.errors?.status?.[0]}
            required
          />
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Responsável financeiro
            </span>
            <select
              name="financial_guardian_id"
              value={selectedFinancialGuardianId}
              onChange={(event) =>
                setSelectedFinancialGuardianId(event.target.value)
              }
              disabled={!selectedStudentId || selectedGuardianLinks.length === 0}
              className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
            >
              <option value="">Sem responsável financeiro informado</option>
              {selectedGuardianLinks.map((link) => (
                <option key={link.id} value={link.guardian_id}>
                  {formatGuardianOption(link)}
                </option>
              ))}
            </select>
            {state.errors?.financial_guardian_id?.[0] ? (
              <span className="mt-1 block text-xs text-red-600">
                {state.errors.financial_guardian_id[0]}
              </span>
            ) : null}
          </label>
          <Field
            label="Valor mensal"
            name="monthly_amount"
            type="number"
            min="0"
            step="0.01"
            error={state.errors?.monthly_amount?.[0]}
          />
          <Field
            label="Desconto"
            name="discount_amount"
            type="number"
            min="0"
            step="0.01"
            error={state.errors?.discount_amount?.[0]}
          />
          <Field
            label="Motivo do desconto"
            name="discount_reason"
            error={state.errors?.discount_reason?.[0]}
          />
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-foreground">Observações</span>
          <textarea
            name="notes"
            rows={5}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          />
          {state.errors?.notes?.[0] ? (
            <span className="mt-1 block text-xs text-red-600">
              {state.errors.notes[0]}
            </span>
          ) : null}
        </label>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Link
          href="/matriculas"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Criar matrícula"}
        </button>
      </div>
    </form>
  );
}

function formatGuardianOption(link: EnrollmentGuardianOption) {
  return [
    link.guardian_name,
    link.relationship_type ? formatRelationship(link.relationship_type) : null,
    link.phone,
  ]
    .filter(Boolean)
    .join(" - ");
}

function formatRelationship(relationship: string) {
  const labels: Record<string, string> = {
    mother: "Mãe",
    father: "Pai",
    family: "Familiar",
    financial: "Financeiro",
    pedagogical: "Pedagógico",
    emergency: "Emergência",
    other: "Outro",
  };

  return labels[relationship] ?? relationship;
}

type StepTitleProps = {
  number: string;
  title: string;
};

function StepTitle({ number, title }: StepTitleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {number}
      </span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
    </div>
  );
}

type ResultRowProps = {
  title: string;
  details: string[];
  selected: boolean;
  actionLabel: string;
  onSelect: () => void;
};

function ResultRow({
  title,
  details,
  selected,
  actionLabel,
  onSelect,
}: ResultRowProps) {
  return (
    <div
      className={`grid gap-3 rounded-md border px-4 py-3 md:grid-cols-[1fr_auto] md:items-center ${
        selected ? "border-primary bg-muted" : "border-border bg-white"
      }`}
    >
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {details.filter(Boolean).join(" · ")}
        </p>
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="h-9 rounded-md border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        {selected ? "Selecionado" : actionLabel}
      </button>
    </div>
  );
}

type SelectedCardProps = {
  title: string;
  details: string[];
};

function SelectedCard({ title, details }: SelectedCardProps) {
  return (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{details.filter(Boolean).join(" · ")}</p>
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  min?: string;
  step?: string;
  error?: string;
  required?: boolean;
};

function Field({
  label,
  name,
  type = "text",
  min,
  step,
  error,
  required,
}: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        min={min}
        step={step}
        required={required}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
      />
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
  required?: boolean;
  defaultValue?: string;
};

function SelectField({
  label,
  name,
  options,
  error,
  required,
  defaultValue = "",
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
}
