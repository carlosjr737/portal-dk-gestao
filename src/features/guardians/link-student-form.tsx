"use client";

import { useActionState } from "react";
import type { GuardianActionState } from "@/features/guardians/actions";
import { guardianRelationshipOptions } from "@/features/guardians/schemas";
import type { StudentOption } from "@/features/guardians/types";

type LinkStudentFormProps = {
  action: (
    previousState: GuardianActionState,
    formData: FormData,
  ) => Promise<GuardianActionState>;
  students: StudentOption[];
};

const initialState: GuardianActionState = {};

export function LinkStudentForm({ action, students }: LinkStudentFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {state.message}
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-foreground">Aluno</span>
        <select
          name="student_id"
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
          defaultValue=""
        >
          <option value="" disabled>
            Selecione um aluno
          </option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.full_name}
            </option>
          ))}
        </select>
        {state.errors?.student_id?.[0] ? (
          <span className="mt-1 block text-xs text-red-600">
            {state.errors.student_id[0]}
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Tipo de vínculo</span>
        <select
          name="relationship_type"
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
          defaultValue="financial"
        >
          {guardianRelationshipOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="is_primary"
          className="h-4 w-4 rounded border-border"
        />
        Responsável principal do aluno
      </label>

      <button
        type="submit"
        disabled={isPending || students.length === 0}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Vinculando..." : "Vincular aluno"}
      </button>
    </form>
  );
}
