"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { studentFormSchema } from "@/features/students/schemas";

export type StudentActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

type GuardianMode = "none" | "existing" | "new";

function formDataToObject(formData: FormData) {
  return {
    full_name: String(formData.get("full_name") ?? ""),
    display_name: String(formData.get("display_name") ?? ""),
    birth_date: String(formData.get("birth_date") ?? ""),
    document: String(formData.get("document") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    status: String(formData.get("status") ?? "active"),
    notes: String(formData.get("notes") ?? ""),
  };
}

function guardianDataToObject(formData: FormData) {
  return {
    guardian_mode: String(formData.get("guardian_mode") ?? "none") as GuardianMode,
    existing_guardian_id: String(formData.get("existing_guardian_id") ?? ""),
    guardian_full_name: String(formData.get("guardian_full_name") ?? "").trim(),
    guardian_phone: String(formData.get("guardian_phone") ?? "").trim(),
    guardian_email: String(formData.get("guardian_email") ?? "").trim(),
    guardian_document: String(formData.get("guardian_document") ?? "").trim(),
    guardian_relationship: String(
      formData.get("guardian_relationship") ?? "",
    ).trim(),
    is_financial_responsible:
      formData.get("is_financial_responsible") === "on",
    is_primary_contact: formData.get("is_primary_contact") === "on",
    is_emergency_contact: formData.get("is_emergency_contact") === "on",
  };
}

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function createStudent(
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = studentFormSchema.safeParse(formDataToObject(formData));
  const guardianData = guardianDataToObject(formData);

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  if (
    guardianData.guardian_mode === "existing" &&
    !guardianData.existing_guardian_id
  ) {
    return {
      errors: {
        existing_guardian_id: ["Selecione um responsável."],
      },
      message: "Selecione um responsável existente para vincular ao aluno.",
    };
  }

  if (guardianData.guardian_mode === "new") {
    if (!guardianData.guardian_full_name) {
      return {
        errors: {
          guardian_full_name: ["Informe o nome completo do responsável."],
        },
        message: "Informe os dados do novo responsável.",
      };
    }

    if (!guardianData.guardian_phone && !guardianData.guardian_email) {
      return {
        errors: {
          guardian_phone: ["Informe telefone ou e-mail do responsável."],
        },
        message: "Informe telefone ou e-mail para evitar duplicidade.",
      };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error || !data) {
    return {
      message: error?.message ?? "Nao foi possivel criar o aluno.",
    };
  }

  if (guardianData.guardian_mode === "none") {
    revalidatePath("/alunos");
    revalidatePath("/dashboard");
    redirect(`/matriculas/nova?studentId=${data.id}&studentCreated=1`);
  }

  let guardianId = guardianData.existing_guardian_id;

  if (guardianData.guardian_mode === "new") {
    const duplicateGuardian = await findDuplicateGuardian(supabase, guardianData);

    if (duplicateGuardian.error) {
      return {
        message:
          "Aluno criado, mas não foi possível validar duplicidade do responsável. Vincule o responsável depois.",
      };
    }

    if (duplicateGuardian.id) {
      guardianId = duplicateGuardian.id;
    } else {
      const { data: guardian, error: guardianError } = await supabase
        .from("guardians")
        .insert({
          full_name: guardianData.guardian_full_name,
          document: nullable(guardianData.guardian_document),
          phone: nullable(guardianData.guardian_phone),
          email: nullable(normalizeEmail(guardianData.guardian_email)),
          notes: null,
        })
        .select("id")
        .single();

      if (guardianError || !guardian) {
        return {
          message:
            "Aluno criado, mas não foi possível criar o responsável. Vincule o responsável depois.",
        };
      }

      guardianId = guardian.id as string;
    }
  }

  if (guardianId) {
    const { error: linkError } = await supabase.from("student_guardians").upsert(
      {
        student_id: data.id,
        guardian_id: guardianId,
        relationship: nullable(guardianData.guardian_relationship),
        relationship_type: guardianData.is_financial_responsible
          ? "financial"
          : null,
        is_primary: guardianData.is_primary_contact,
        is_financial_responsible: guardianData.is_financial_responsible,
        is_primary_contact: guardianData.is_primary_contact,
        is_emergency_contact: guardianData.is_emergency_contact,
      },
      {
        onConflict: "student_id,guardian_id",
      },
    );

    if (linkError) {
      return {
        message:
          "Aluno criado, mas não foi possível vincular o responsável. Vincule o responsável depois.",
      };
    }
  }

  revalidatePath("/alunos");
  revalidatePath("/dashboard");
  redirect(`/matriculas/nova?studentId=${data.id}&studentCreated=1`);
}

async function findDuplicateGuardian(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guardianData: ReturnType<typeof guardianDataToObject>,
): Promise<{ id: string | null; error: boolean }> {
  const filters = [
    guardianData.guardian_document
      ? `document.eq.${guardianData.guardian_document}`
      : null,
    guardianData.guardian_email
      ? `email.eq.${normalizeEmail(guardianData.guardian_email)}`
      : null,
    guardianData.guardian_phone ? `phone.eq.${guardianData.guardian_phone}` : null,
  ].filter(Boolean);

  if (filters.length === 0) {
    return { id: null, error: false };
  }

  const { data, error } = await supabase
    .from("guardians")
    .select("id")
    .or(filters.join(","))
    .limit(1);

  if (error) {
    return { id: null, error: true };
  }

  return { id: ((data?.[0]?.id as string | undefined) ?? null), error: false };
}

export async function updateStudent(
  studentId: string,
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = studentFormSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update(parsed.data)
    .eq("id", studentId);

  if (error) {
    return {
      message: error.message,
    };
  }

  revalidatePath("/alunos");
  revalidatePath(`/alunos/${studentId}`);
  redirect(`/alunos/${studentId}`);
}
