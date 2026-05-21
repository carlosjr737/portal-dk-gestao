"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  guardianFormSchema,
  linkGuardianToStudentSchema,
} from "@/features/guardians/schemas";

export type GuardianActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

function guardianFormDataToObject(formData: FormData) {
  return {
    full_name: String(formData.get("full_name") ?? ""),
    document: String(formData.get("document") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createGuardian(
  _previousState: GuardianActionState,
  formData: FormData,
): Promise<GuardianActionState> {
  const parsed = guardianFormSchema.safeParse(guardianFormDataToObject(formData));

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guardians")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error || !data) {
    return {
      message: error?.message ?? "Nao foi possivel criar o responsavel.",
    };
  }

  revalidatePath("/responsaveis");
  redirect(`/responsaveis/${data.id}`);
}

export async function updateGuardian(
  guardianId: string,
  _previousState: GuardianActionState,
  formData: FormData,
): Promise<GuardianActionState> {
  const parsed = guardianFormSchema.safeParse(guardianFormDataToObject(formData));

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("guardians")
    .update(parsed.data)
    .eq("id", guardianId);

  if (error) {
    return {
      message: error.message,
    };
  }

  revalidatePath("/responsaveis");
  revalidatePath(`/responsaveis/${guardianId}`);
  redirect(`/responsaveis/${guardianId}`);
}

export async function linkGuardianToStudent(
  guardianId: string,
  _previousState: GuardianActionState,
  formData: FormData,
): Promise<GuardianActionState> {
  const parsed = linkGuardianToStudentSchema.safeParse({
    student_id: String(formData.get("student_id") ?? ""),
    relationship_type: String(formData.get("relationship_type") ?? ""),
    is_primary: formData.get("is_primary") === "on",
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("student_guardians").upsert(
    {
      guardian_id: guardianId,
      student_id: parsed.data.student_id,
      relationship_type: parsed.data.relationship_type,
      is_primary: parsed.data.is_primary,
    },
    {
      onConflict: "student_id,guardian_id",
    },
  );

  if (error) {
    return {
      message: error.message,
    };
  }

  revalidatePath(`/responsaveis/${guardianId}`);
  revalidatePath(`/alunos/${parsed.data.student_id}`);

  return {
    message: "Vinculo atualizado com sucesso.",
  };
}
