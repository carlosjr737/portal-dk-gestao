"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { staffMemberFormSchema } from "@/features/staff/schemas";
import { teacherPhotosBucket } from "@/features/staff/teacher-photo";

export type StaffActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxPhotoSize = 5 * 1024 * 1024;

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
  const { data, error } = await supabase
    .from("staff_members")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error || !data) {
    return {
      message: "Nao foi possivel cadastrar o professor/equipe.",
    };
  }

  const photoResult = await uploadStaffPhoto(formData, data.id);

  if (photoResult.status === "failed") {
    return {
      errors: { photo: [photoResult.message] },
      message: "Professor/equipe cadastrado, mas a foto nao foi enviada.",
    };
  }

  if (photoResult.photoPath) {
    await supabase
      .from("staff_members")
      .update({ photo_path: photoResult.photoPath })
      .eq("id", data.id);
  }

  revalidatePath("/professores");
  revalidatePath("/turmas/novo");
  revalidatePath("/dna-professores");

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

  const photoResult = await uploadStaffPhoto(formData, staffMemberId);

  if (photoResult.status === "failed") {
    return {
      errors: { photo: [photoResult.message] },
      message: "Nao foi possivel enviar a foto.",
    };
  }

  const supabase = await createClient();
  const updatePayload = {
    ...parsed.data,
    ...(photoResult.photoPath ? { photo_path: photoResult.photoPath } : {}),
  };
  const { error } = await supabase
    .from("staff_members")
    .update(updatePayload)
    .eq("id", staffMemberId);

  if (error) {
    return {
      message: "Nao foi possivel atualizar o professor/equipe.",
    };
  }

  revalidatePath("/professores");
  revalidatePath("/turmas");
  revalidatePath("/dna-professores");
  revalidatePath(`/dna-professores/${staffMemberId}`);

  return {
    message: "Professor/equipe atualizado com sucesso.",
  };
}

async function uploadStaffPhoto(formData: FormData, staffMemberId: string) {
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "skipped" as const, photoPath: null };
  }

  if (!acceptedImageTypes.includes(file.type)) {
    return {
      status: "failed" as const,
      message: "Envie uma imagem JPG, PNG ou WEBP.",
    };
  }

  if (file.size > maxPhotoSize) {
    return {
      status: "failed" as const,
      message: "A foto deve ter no maximo 5MB.",
    };
  }

  const extension = getExtension(file);
  const photoPath = `professores/${staffMemberId}/${Date.now()}.${extension}`;
  const supabase = createAdminClient();
  await ensureTeacherPhotosBucket(supabase);

  const { error } = await supabase.storage
    .from(teacherPhotosBucket)
    .upload(photoPath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    console.error("[TEACHER PHOTO] upload failed", error.message);
    return {
      status: "failed" as const,
      message: "Nao foi possivel enviar a foto para o Storage.",
    };
  }

  return { status: "uploaded" as const, photoPath };
}

async function ensureTeacherPhotosBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase.storage.getBucket(teacherPhotosBucket);

  if (data) {
    return;
  }

  const { error } = await supabase.storage.createBucket(teacherPhotosBucket, {
    public: true,
    fileSizeLimit: maxPhotoSize,
    allowedMimeTypes: acceptedImageTypes,
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.error("[TEACHER PHOTO] bucket create failed", error.message);
  }
}

function getExtension(file: File) {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensionByType[file.type] ?? "jpg";
}
