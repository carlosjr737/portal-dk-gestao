"use client";

import { Fragment, useActionState, useState } from "react";
import Link from "next/link";
import type { ClassActionState } from "@/features/classes/actions";
import {
  classScheduleWeekdayOptions,
  type ClassScheduleFormData,
} from "@/features/classes/schemas";
import type { CatalogOption } from "@/features/class-catalog/types";
import { getStaffDisplayName } from "@/features/staff/formatters";
import type { TeacherOption } from "@/features/staff/types";

type ClassFormProps = {
  action: (
    previousState: ClassActionState,
    formData: FormData,
  ) => Promise<ClassActionState>;
  defaultValues?: {
    name?: string | null;
    teacher_id?: string | null;
    instructor_name?: string | null;
    category?: string | null;
    modality_id?: string | null;
    level_id?: string | null;
    capacity?: number | null;
    notes?: string | null;
    schedules?: ClassScheduleFormData[];
  };
  teachers: TeacherOption[];
  modalities: CatalogOption[];
  levels: CatalogOption[];
  submitLabel: string;
  hideName?: boolean;
};

const initialState: ClassActionState = {};

type ScheduleRow = ClassScheduleFormData & {
  enabled: boolean;
};

function buildInitialScheduleRows(
  schedules: ClassScheduleFormData[] | undefined,
): ScheduleRow[] {
  return classScheduleWeekdayOptions.map((option) => {
    const existingSchedule = schedules?.find(
      (schedule) => schedule.weekday === option.value,
    );

    return {
      weekday: option.value,
      start_time: existingSchedule?.start_time.slice(0, 5) ?? "",
      end_time: existingSchedule?.end_time.slice(0, 5) ?? "",
      room: existingSchedule?.room ?? null,
      enabled: Boolean(existingSchedule),
    };
  });
}

export function ClassForm({
  action,
  defaultValues,
  teachers,
  modalities,
  levels,
  submitLabel,
  hideName,
}: ClassFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(() =>
    buildInitialScheduleRows(defaultValues?.schedules),
  );
  const hasTeachers = teachers.length > 0;
  const hasModalities = modalities.length > 0;
  const hasLevels = levels.length > 0;

  function updateSchedule(
    index: number,
    field: keyof Omit<ScheduleRow, "weekday">,
    value: string | boolean,
  ) {
    setScheduleRows((currentRows) =>
      currentRows.map((schedule, currentIndex) =>
        currentIndex === index ? { ...schedule, [field]: value } : schedule,
      ),
    );
  }

  return (
    <form action={formAction} className="mt-6 max-w-4xl space-y-6">
      {state.message ? (
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {!hideName ? (
          <Field
            label="Nome da turma"
            name="name"
            defaultValue={defaultValues?.name ?? ""}
            error={state.errors?.name?.[0]}
            required
          />
        ) : null}
        <label className="block">
          <span className="text-sm font-medium text-foreground">Professor</span>
          <select
            name="teacher_id"
            defaultValue={defaultValues?.teacher_id ?? ""}
            required
            disabled={!hasTeachers}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
          >
            <option value="">
              {hasTeachers
                ? "Selecione um professor"
                : "Nenhum professor cadastrado"}
            </option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {getStaffDisplayName(teacher)}
              </option>
            ))}
          </select>
          {state.errors?.teacher_id?.[0] ? (
            <span className="mt-1 block text-xs text-red-600">
              {state.errors.teacher_id[0]}
            </span>
          ) : null}
          {!hasTeachers ? (
            <span className="mt-1 block text-xs text-red-600">
              Nenhum professor cadastrado. Cadastre um professor antes de criar a
              turma.
            </span>
          ) : null}
        </label>
        {defaultValues?.instructor_name && !defaultValues.teacher_id ? (
          <Field
            label="Professor legado"
            name="instructor_name"
            defaultValue={defaultValues.instructor_name}
            error={state.errors?.instructor_name?.[0]}
            disabled
          />
        ) : null}
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Modalidade
          </span>
          <select
            name="modality_id"
            defaultValue={defaultValues?.modality_id ?? ""}
            required
            disabled={!hasModalities}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
          >
            <option value="">
              {hasModalities
                ? "Selecione uma modalidade"
                : "Nenhuma modalidade cadastrada"}
            </option>
            {modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}
          </select>
          {state.errors?.modality_id?.[0] ? (
            <span className="mt-1 block text-xs text-red-600">
              {state.errors.modality_id[0]}
            </span>
          ) : null}
          {!hasModalities ? (
            <span className="mt-1 block text-xs text-red-600">
              Nenhuma modalidade cadastrada. Cadastre uma modalidade antes de
              criar a turma.
            </span>
          ) : null}
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">Nível</span>
          <select
            name="level_id"
            defaultValue={defaultValues?.level_id ?? ""}
            required
            disabled={!hasLevels}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
          >
            <option value="">
              {hasLevels ? "Selecione um nível" : "Nenhum nível cadastrado"}
            </option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
          {state.errors?.level_id?.[0] ? (
            <span className="mt-1 block text-xs text-red-600">
              {state.errors.level_id[0]}
            </span>
          ) : null}
          {!hasLevels ? (
            <span className="mt-1 block text-xs text-red-600">
              Nenhum nível cadastrado. Cadastre um nível antes de criar a turma.
            </span>
          ) : null}
        </label>
        <Field
          label="Capacidade"
          name="capacity"
          type="number"
          min="1"
          defaultValue={defaultValues?.capacity?.toString() ?? ""}
          error={state.errors?.capacity?.[0]}
          required
        />
      </div>

      <section className="rounded-md border border-border bg-white p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Dias e horários das aulas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Marque os dias em que a turma acontece e preencha os horários.
          </p>
        </div>

        {state.errors?.schedules?.[0] ? (
          <span className="mt-3 block text-xs text-red-600">
            {state.errors.schedules[0]}
          </span>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[220px]" />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
                <col />
              </colgroup>
              <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Dia da semana
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Início
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Até
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Sala
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scheduleRows.map((schedule, index) => {
                  const weekdayLabel =
                    classScheduleWeekdayOptions.find(
                      (option) => option.value === schedule.weekday,
                    )?.label ?? schedule.weekday;

                  return (
                    <Fragment key={schedule.weekday}>
                      <tr
                        className={!schedule.enabled ? "opacity-60" : undefined}
                      >
                        <td className="px-3 py-2 align-middle">
                          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <input
                              type="checkbox"
                              checked={schedule.enabled}
                              onChange={(event) =>
                                updateSchedule(
                                  index,
                                  "enabled",
                                  event.target.checked,
                                )
                              }
                              className="h-4 w-4 rounded border-border"
                            />
                            {weekdayLabel}
                          </label>

                          {schedule.enabled ? (
                            <input
                              type="hidden"
                              name="schedule_weekday"
                              value={schedule.weekday}
                            />
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            name={
                              schedule.enabled
                                ? "schedule_start_time"
                                : undefined
                            }
                            type="time"
                            value={schedule.start_time}
                            disabled={!schedule.enabled}
                            required={schedule.enabled}
                            onChange={(event) =>
                              updateSchedule(
                                index,
                                "start_time",
                                event.target.value,
                              )
                            }
                            className="h-9 w-28 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            name={
                              schedule.enabled ? "schedule_end_time" : undefined
                            }
                            type="time"
                            value={schedule.end_time}
                            disabled={!schedule.enabled}
                            required={schedule.enabled}
                            onChange={(event) =>
                              updateSchedule(
                                index,
                                "end_time",
                                event.target.value,
                              )
                            }
                            className="h-9 w-28 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            name={schedule.enabled ? "schedule_room" : undefined}
                            value={schedule.room ?? ""}
                            disabled={!schedule.enabled}
                            placeholder="Opcional"
                            onChange={(event) =>
                              updateSchedule(index, "room", event.target.value)
                            }
                            className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
                          />
                        </td>
                      </tr>
                      {state.errors?.schedules?.[index] ? (
                        <tr>
                          <td
                            className="px-3 pb-2 text-xs text-red-600"
                            colSpan={4}
                          >
                            {state.errors.schedules[index]}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Observações</span>
        <textarea
          name="notes"
          defaultValue={defaultValues?.notes ?? ""}
          rows={5}
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
        />
        {state.errors?.notes?.[0] ? (
          <span className="mt-1 block text-xs text-red-600">
            {state.errors.notes[0]}
          </span>
        ) : null}
      </label>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Link
          href="/turmas"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending || !hasTeachers || !hasModalities || !hasLevels}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  min?: string;
  defaultValue: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
};

function Field({
  label,
  name,
  type = "text",
  min,
  defaultValue,
  error,
  required,
  disabled,
  onChange,
}: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        min={min}
        value={onChange ? defaultValue : undefined}
        defaultValue={onChange ? undefined : defaultValue}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
      />
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
}
