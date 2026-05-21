"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { staffMemberFormSchema } from "@/features/staff/schemas";

export type StaffActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

function staffFormDataToObject(formData: FormData) {
  return {
    full_name: String(formData.get("full_name") ?? ""),
    artistic_name: String(formData.get("artistic_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    role: String(formData.get("role") ?? "professor"),
    status: String(formData.get("status") ?? "active"),
  };
}

export async function createStaffMember(
  _previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = staffMemberFormSchema.safeParse(staffFormDataToObject(formData));

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("staff_members").insert(parsed.data);

  if (error) {
    return {
      message: "Nao foi possivel cadastrar o professor/equipe.",
    };
  }

  revalidatePath("/professores");
  revalidatePath("/turmas/novo");

  return {
    message: "Professor/equipe cadastrado com sucesso.",
  };
}

export async function updateStaffMember(
  staffMemberId: string,
  _previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = staffMemberFormSchema.safeParse(staffFormDataToObject(formData));

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_members")
    .update(parsed.data)
    .eq("id", staffMemberId);

  if (error) {
    return {
      message: "Nao foi possivel atualizar o professor/equipe.",
    };
  }

  revalidatePath("/professores");
  revalidatePath("/turmas");

  return {
    message: "Professor/equipe atualizado com sucesso.",
  };
}
