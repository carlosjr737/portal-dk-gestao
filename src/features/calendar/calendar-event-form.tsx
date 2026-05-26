"use client";

import { useActionState, useState } from "react";
import type { CalendarActionState } from "@/features/calendar/actions";
import {
  calendarEventTypes,
  type CalendarEventFormData,
} from "@/features/calendar/schemas";
import type {
  CalendarEventFormOptions,
  CalendarEventType,
} from "@/features/calendar/types";

type CalendarEventFormProps = {
  action: (
    previousState: CalendarActionState,
    formData: FormData,
  ) => Promise<CalendarActionState>;
  options: CalendarEventFormOptions;
  defaultValues?: Partial<CalendarEventFormData>;
  submitLabel: string;
  compact?: boolean;
};

const initialState: CalendarActionState = {};

export function CalendarEventForm({
  action,
  options,
  defaultValues,
  submitLabel,
  compact,
}: CalendarEventFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [dateError, setDateError] = useState<string | null>(null);
  const [allDay, setAllDay] = useState(defaultValues?.all_day ?? true);
  const [affectsClasses, setAffectsClasses] = useState(
    defaultValues?.affects_classes ?? false,
  );
  const [affectsAllClasses, setAffectsAllClasses] = useState(
    defaultValues?.affects_all_classes ?? false,
  );

  return (
    <form
      action={formAction}
      className={compact ? "space-y-3" : "mt-5 space-y-4"}
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const startDate = String(formData.get("start_date") ?? "");
        const endDate = String(formData.get("end_date") ?? "");

        if (startDate && endDate && endDate < startDate) {
          event.preventDefault();
          setDateError("A data final não pode ser menor que a inicial.");
          return;
        }

        setDateError(null);
      }}
    >
      {state.message ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Título"
          name="title"
          defaultValue={defaultValues?.title ?? ""}
          error={state.errors?.title?.[0]}
          required
        />
        <EventTypeField
          label="Tipo"
          name="event_type"
          defaultValue={defaultValues?.event_type ?? "evento"}
          options={calendarEventTypes}
          error={state.errors?.event_type?.[0]}
          onTypeChange={(eventType) => {
            if (
              eventType === "feriado" ||
              eventType === "recesso" ||
              eventType === "aula_suspensa"
            ) {
              setAffectsClasses(true);
            }
          }}
        />
        <Field
          label="Data inicial"
          name="start_date"
          type="date"
          defaultValue={defaultValues?.start_date ?? ""}
          error={state.errors?.start_date?.[0]}
          required
        />
        <Field
          label="Data final"
          name="end_date"
          type="date"
          defaultValue={defaultValues?.end_date ?? defaultValues?.start_date ?? ""}
          error={dateError ?? state.errors?.end_date?.[0]}
          required
        />

        <ToggleField
          label="Dia inteiro?"
          name="all_day"
          checked={allDay}
          onChange={setAllDay}
        />

        {!allDay ? (
          <>
            <Field
              label="Hora inicial"
              name="start_time"
              type="time"
              defaultValue={defaultValues?.start_time ?? ""}
              error={state.errors?.start_time?.[0]}
            />
            <Field
              label="Hora final"
              name="end_time"
              type="time"
              defaultValue={defaultValues?.end_time ?? ""}
              error={state.errors?.end_time?.[0]}
            />
          </>
        ) : null}

        <ToggleField
          label="Afeta aulas?"
          name="affects_classes"
          checked={affectsClasses}
          onChange={(checked) => {
            setAffectsClasses(checked);
            if (!checked) {
              setAffectsAllClasses(false);
            }
          }}
        />

        {affectsClasses ? (
          <ToggleField
            label="Afeta todas as turmas?"
            name="affects_all_classes"
            checked={affectsAllClasses}
            onChange={setAffectsAllClasses}
          />
        ) : null}

        {affectsClasses && !affectsAllClasses ? (
          <>
            <SelectField
              label="Turma específica"
              name="class_id"
              defaultValue={defaultValues?.class_id ?? ""}
              options={[
                { value: "", label: "Todas aplicáveis" },
                ...options.classes.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
              error={state.errors?.class_id?.[0]}
            />
            <SelectField
              label="Professor"
              name="teacher_id"
              defaultValue={defaultValues?.teacher_id ?? ""}
              options={[
                { value: "", label: "Todos aplicáveis" },
                ...options.teachers.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
              error={state.errors?.teacher_id?.[0]}
            />
            <SelectField
              label="Modalidade"
              name="modality_id"
              defaultValue={defaultValues?.modality_id ?? ""}
              options={[
                { value: "", label: "Todas aplicáveis" },
                ...options.modalities.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
              error={state.errors?.modality_id?.[0]}
            />
            <SelectField
              label="Nível"
              name="level_id"
              defaultValue={defaultValues?.level_id ?? ""}
              options={[
                { value: "", label: "Todos aplicáveis" },
                ...options.levels.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
              error={state.errors?.level_id?.[0]}
            />
          </>
        ) : null}

        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-foreground">Descrição</span>
          <textarea
            name="description"
            defaultValue={defaultValues?.description ?? ""}
            rows={compact ? 3 : 4}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          />
          {state.errors?.description?.[0] ? (
            <span className="mt-1 block text-xs text-red-600">
              {state.errors.description[0]}
            </span>
          ) : null}
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}

type EventTypeFieldProps = SelectFieldProps & {
  onTypeChange: (eventType: CalendarEventType) => void;
};

function EventTypeField({
  label,
  name,
  defaultValue,
  options,
  error,
  onTypeChange,
}: EventTypeFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        onChange={(event) => onTypeChange(event.target.value as CalendarEventType)}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
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

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue: string;
  error?: string;
  required?: boolean;
};

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  error,
  required,
}: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
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
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
};

function SelectField({
  label,
  name,
  defaultValue,
  options,
  error,
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
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

type ToggleFieldProps = {
  label: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleField({ label, name, checked, onChange }: ToggleFieldProps) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground">
      <input
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}
