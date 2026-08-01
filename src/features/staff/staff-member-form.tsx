"use client";

import { useActionState, useMemo, useState } from "react";
import type { StaffActionState } from "@/features/staff/actions";
import { TeacherAvatar } from "@/features/staff/teacher-avatar";
import {
  staffRoleOptions,
  staffStatusOptions,
  type StaffMemberFormData,
} from "@/features/staff/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field as FormField } from "@/components/ui/field";

type StaffMemberFormProps = {
  action: (
    previousState: StaffActionState,
    formData: FormData,
  ) => Promise<StaffActionState>;
  defaultValues?: Partial<StaffMemberFormData> & {
    photo_path?: string | null;
  };
  submitLabel: string;
  compact?: boolean;
};

const initialState: StaffActionState = {};

export function StaffMemberForm({
  action,
  defaultValues,
  submitLabel,
  compact,
}: StaffMemberFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const displayName =
    defaultValues?.artistic_name || defaultValues?.full_name || "Professor";
  const currentPhotoPath = defaultValues?.photo_path ?? null;
  const acceptedTypesLabel = useMemo(() => "JPG, PNG ou WEBP ate 5MB", []);

  return (
    <form
      action={formAction}
      className={compact ? "space-y-3" : "mt-6 max-w-4xl space-y-4"}
    >
      {state.message ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {state.message}
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-4">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Preview da foto"
              className="h-16 w-16 rounded-full border border-border object-cover"
            />
          ) : (
            <TeacherAvatar
              name={displayName}
              photoPath={currentPhotoPath}
              size="lg"
            />
          )}
          <label className="min-w-[240px] flex-1">
            <span className="text-sm font-medium text-foreground">
              Foto do professor
            </span>
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPreviewUrl(file ? URL.createObjectURL(file) : null);
              }}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              {acceptedTypesLabel}
            </span>
            {state.errors?.photo?.[0] ? (
              <span className="mt-1 block text-xs text-red-600">
                {state.errors.photo[0]}
              </span>
            ) : null}
          </label>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Nome completo"
          name="full_name"
          defaultValue={defaultValues?.full_name ?? ""}
          error={state.errors?.full_name?.[0]}
          required
        />
        <Field
          label="Nome artístico"
          name="artistic_name"
          defaultValue={defaultValues?.artistic_name ?? ""}
          error={state.errors?.artistic_name?.[0]}
        />
        <Field
          label="E-mail"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ""}
          error={state.errors?.email?.[0]}
        />
        <Field
          label="Telefone"
          name="phone"
          defaultValue={defaultValues?.phone ?? ""}
          error={state.errors?.phone?.[0]}
        />
        <SelectField
          label="Função"
          name="role"
          defaultValue={defaultValues?.role ?? "professor"}
          options={staffRoleOptions}
          error={state.errors?.role?.[0]}
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={defaultValues?.status ?? "active"}
          options={staffStatusOptions}
          error={state.errors?.status?.[0]}
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
      >
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </form>
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
    <FormField label={label} error={error} required={required}>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
      />
    </FormField>
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
      <Select
        name={name}
        defaultValue={defaultValue}
        className="mt-1"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
}
