"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  studentStatusOptions,
  type StudentFormData,
} from "@/features/students/schemas";
import type { StudentActionState } from "@/features/students/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Field as FormField } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

type StudentFormProps = {
  action: (
    previousState: StudentActionState,
    formData: FormData,
  ) => Promise<StudentActionState>;
  defaultValues?: Partial<StudentFormData>;
  guardians?: GuardianSearchOption[];
  submitLabel: string;
};

export type GuardianSearchOption = {
  id: string;
  full_name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
};

const initialState: StudentActionState = {};

export function StudentForm({
  action,
  defaultValues,
  guardians,
  submitLabel,
}: StudentFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [guardianMode, setGuardianMode] = useState<"none" | "existing" | "new">(
    "none",
  );
  const [guardianSearch, setGuardianSearch] = useState("");
  const [selectedGuardianId, setSelectedGuardianId] = useState("");
  const [newGuardianPhone, setNewGuardianPhone] = useState("");
  const [newGuardianEmail, setNewGuardianEmail] = useState("");
  const [newGuardianDocument, setNewGuardianDocument] = useState("");
  const guardianOptions = useMemo(() => guardians ?? [], [guardians]);
  const shouldShowGuardianFlow = Boolean(guardians);
  const selectedGuardian = guardianOptions.find(
    (guardian) => guardian.id === selectedGuardianId,
  );
  const guardianResults = useMemo(() => {
    const search = guardianSearch.trim().toLocaleLowerCase("pt-BR");

    if (!search) {
      return guardianOptions.slice(0, 8);
    }

    return guardianOptions
      .filter((guardian) =>
        [
          guardian.full_name,
          guardian.document,
          guardian.phone,
          guardian.email,
        ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(search)),
      )
      .slice(0, 8);
  }, [guardianOptions, guardianSearch]);
  const duplicateGuardian = guardianOptions.find((guardian) =>
    [
      newGuardianDocument && guardian.document === newGuardianDocument,
      newGuardianEmail &&
        guardian.email?.toLocaleLowerCase("pt-BR") ===
          newGuardianEmail.toLocaleLowerCase("pt-BR"),
      newGuardianPhone && guardian.phone === newGuardianPhone,
    ].some(Boolean),
  );

  return (
    <form action={formAction} className="mt-6 max-w-3xl space-y-6">
      {state.message ? (
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nome completo"
          name="full_name"
          defaultValue={defaultValues?.full_name ?? ""}
          error={state.errors?.full_name?.[0]}
          required
        />
        <Field
          label="Nome social ou artístico"
          name="display_name"
          defaultValue={defaultValues?.display_name ?? ""}
          error={state.errors?.display_name?.[0]}
        />
        <Field
          label="Data de nascimento"
          name="birth_date"
          type="date"
          defaultValue={defaultValues?.birth_date ?? ""}
          error={state.errors?.birth_date?.[0]}
        />
        <Field
          label="Documento"
          name="document"
          defaultValue={defaultValues?.document ?? ""}
          error={state.errors?.document?.[0]}
        />
        <Field
          label="Telefone"
          name="phone"
          defaultValue={defaultValues?.phone ?? ""}
          error={state.errors?.phone?.[0]}
        />
        <Field
          label="E-mail"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ""}
          error={state.errors?.email?.[0]}
        />
      </div>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Status</span>
        <Select
          name="status"
          defaultValue={defaultValues?.status ?? "active"}
          className="mt-1 py-2"
        >
          {studentStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {state.errors?.status?.[0] ? (
          <span className="mt-1 block text-xs text-red-600">
            {state.errors.status[0]}
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Observações</span>
        <Textarea
          name="notes"
          defaultValue={defaultValues?.notes ?? ""}
          rows={5}
          className="mt-1"
        />
        {state.errors?.notes?.[0] ? (
          <span className="mt-1 block text-xs text-red-600">
            {state.errors.notes[0]}
          </span>
        ) : null}
      </label>

      {shouldShowGuardianFlow ? (
        <Card className="p-5">
          <h2 className="text-base font-semibold text-foreground">
            Responsável financeiro
          </h2>
          <input type="hidden" name="guardian_mode" value={guardianMode} />
          <input
            type="hidden"
            name="existing_guardian_id"
            value={selectedGuardianId}
          />

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <ModeButton
              label="Sem responsável"
              active={guardianMode === "none"}
              onClick={() => setGuardianMode("none")}
            />
            <ModeButton
              label="Buscar existente"
              active={guardianMode === "existing"}
              onClick={() => setGuardianMode("existing")}
            />
            <ModeButton
              label="Cadastrar novo"
              active={guardianMode === "new"}
              onClick={() => setGuardianMode("new")}
            />
          </div>

          {guardianMode === "none" ? (
            <Alert tone="warning" className="mt-4 px-3 py-2">
              Aluno criado sem responsável financeiro. Você poderá vincular
              depois.
            </Alert>
          ) : null}

          {guardianMode === "existing" ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">
                    Buscar responsável
                  </span>
                  <Input
                    value={guardianSearch}
                    onChange={(event) => setGuardianSearch(event.target.value)}
                    placeholder="Nome, telefone, e-mail ou CPF"
                    className="mt-1 py-2"
                  />
                </label>
                <Button variant="secondary" type="button">
                  Buscar
                </Button>
              </div>
              {state.errors?.existing_guardian_id?.[0] ? (
                <span className="block text-xs text-red-600">
                  {state.errors.existing_guardian_id[0]}
                </span>
              ) : null}
              <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
                {guardianResults.length > 0 ? (
                  guardianResults.map((guardian) => (
                    <button
                      key={guardian.id}
                      type="button"
                      onClick={() => setSelectedGuardianId(guardian.id)}
                      className={`block w-full px-4 py-3 text-left text-sm transition hover:bg-muted ${
                        selectedGuardianId === guardian.id ? "bg-muted" : ""
                      }`}
                    >
                      <span className="font-medium text-foreground">
                        {guardian.full_name}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {[guardian.phone, guardian.email, guardian.document]
                          .filter(Boolean)
                          .join(" · ") || "Sem contato informado"}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    Nenhum responsável encontrado. Use a opção cadastrar novo.
                  </p>
                )}
              </div>
              {selectedGuardian ? (
                <Alert tone="success" className="px-3 py-2">
                  Responsável selecionado: {selectedGuardian.full_name}
                </Alert>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-3">
                <CheckboxField
                  label="Responsável financeiro"
                  name="is_financial_responsible"
                  defaultChecked
                />
                <CheckboxField
                  label="Contato principal"
                  name="is_primary_contact"
                  defaultChecked
                />
                <CheckboxField
                  label="Contato de emergência"
                  name="is_emergency_contact"
                />
              </div>
              <Field
                label="Parentesco"
                name="guardian_relationship"
                defaultValue=""
                error={state.errors?.guardian_relationship?.[0]}
              />
            </div>
          ) : null}

          {guardianMode === "new" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Nome completo do responsável"
                name="guardian_full_name"
                defaultValue=""
                error={state.errors?.guardian_full_name?.[0]}
                required={guardianMode === "new"}
              />
              <Field
                label="Telefone"
                name="guardian_phone"
                defaultValue=""
                error={state.errors?.guardian_phone?.[0]}
                onChange={setNewGuardianPhone}
              />
              <Field
                label="E-mail"
                name="guardian_email"
                type="email"
                defaultValue=""
                error={state.errors?.guardian_email?.[0]}
                onChange={setNewGuardianEmail}
              />
              <Field
                label="Documento/CPF"
                name="guardian_document"
                defaultValue=""
                error={state.errors?.guardian_document?.[0]}
                onChange={setNewGuardianDocument}
              />
              <Field
                label="Parentesco"
                name="guardian_relationship"
                defaultValue=""
                error={state.errors?.guardian_relationship?.[0]}
              />
              <div className="space-y-3">
                <CheckboxField
                  label="Responsável financeiro"
                  name="is_financial_responsible"
                  defaultChecked
                />
                <CheckboxField
                  label="Contato principal"
                  name="is_primary_contact"
                  defaultChecked
                />
                <CheckboxField
                  label="Contato de emergência"
                  name="is_emergency_contact"
                />
              </div>
              {duplicateGuardian ? (
                <Alert tone="warning" className="sm:col-span-2 px-3 py-2">
                  Já existe um responsável com esses dados. Deseja vincular este
                  responsável? Use a aba buscar existente e selecione{" "}
                  {duplicateGuardian.full_name}.
                </Alert>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Link
          href="/alunos"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
        <Button
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Salvando..." : submitLabel}
        </Button>
      </div>
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
  onChange?: (value: string) => void;
};

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  error,
  required,
  onChange,
}: FieldProps) {
  return (
    <FormField label={label} error={error} required={required}>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        onChange={(event) => onChange?.(event.target.value)}
        className="py-2"
      />
    </FormField>
  );
}

type ModeButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function ModeButton({ label, active, onClick }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-white text-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

type CheckboxFieldProps = {
  label: string;
  name: string;
  defaultChecked?: boolean;
};

function CheckboxField({ label, name, defaultChecked }: CheckboxFieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-border"
      />
      {label}
    </label>
  );
}
