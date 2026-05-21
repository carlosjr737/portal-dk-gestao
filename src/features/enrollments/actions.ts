"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  enrollmentCancellationReasonSchema,
  enrollmentFormSchema,
} from "@/features/enrollments/schemas";
import { ensureGrowthChurnEvent } from "@/features/finance/growth-churn/events";

export type EnrollmentActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

const cancelEnrollmentSchema = z.object({
  enrollment_id: z.string().uuid("Matrícula inválida."),
  cancellation_reason: enrollmentCancellationReasonSchema,
  cancellation_notes: z.string().trim().nullable(),
}).refine(
  (data) =>
    data.cancellation_reason !== "Outro" ||
    Boolean(data.cancellation_notes?.trim()),
  {
    path: ["cancellation_notes"],
    message: "Informe a observação complementar para o motivo Outro.",
  },
);

function enrollmentFormDataToObject(formData: FormData) {
  return {
    student_id: String(formData.get("student_id") ?? ""),
    class_id: String(formData.get("class_id") ?? ""),
    start_date: String(formData.get("start_date") ?? ""),
    end_date: String(formData.get("end_date") ?? ""),
    status: String(formData.get("status") ?? "active"),
    financial_guardian_id: String(formData.get("financial_guardian_id") ?? ""),
    monthly_amount: String(formData.get("monthly_amount") ?? ""),
    discount_amount: String(formData.get("discount_amount") ?? ""),
    discount_reason: String(formData.get("discount_reason") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createEnrollment(
  _previousState: EnrollmentActionState,
  formData: FormData,
): Promise<EnrollmentActionState> {
  const parsed = enrollmentFormSchema.safeParse(
    enrollmentFormDataToObject(formData),
  );

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();

  if (parsed.data.status === "active") {
    const { data: existingEnrollment, error: duplicateError } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", parsed.data.student_id)
      .eq("class_id", parsed.data.class_id)
      .eq("status", "active")
      .maybeSingle();

    if (duplicateError) {
      console.error("Enrollment duplicate check error:", duplicateError);
      return {
        message: `Não foi possível validar matrículas existentes: ${duplicateError.message}`,
      };
    }

    if (existingEnrollment) {
      return {
        errors: {
          class_id: ["Este aluno já possui matrícula ativa nesta turma."],
        },
        message: "Este aluno já possui matrícula ativa nesta turma.",
      };
    }
  }

  if (parsed.data.financial_guardian_id) {
    const { data: guardianLink, error: guardianLinkError } = await supabase
      .from("student_guardians")
      .select("id")
      .eq("student_id", parsed.data.student_id)
      .eq("guardian_id", parsed.data.financial_guardian_id)
      .maybeSingle();

    if (guardianLinkError) {
      console.error("Enrollment guardian link check error:", guardianLinkError);
      return {
        message: `Não foi possível validar o responsável financeiro: ${guardianLinkError.message}`,
      };
    }

    if (!guardianLink) {
      return {
        errors: {
          financial_guardian_id: [
            "Selecione um responsável vinculado ao aluno.",
          ],
        },
        message: "O responsável financeiro precisa estar vinculado ao aluno.",
      };
    }
  }

  const payload = {
    student_id: parsed.data.student_id,
    class_id: parsed.data.class_id,
    status: parsed.data.status,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    financial_guardian_id: parsed.data.financial_guardian_id,
    monthly_amount: parsed.data.monthly_amount,
    discount_amount: parsed.data.discount_amount,
    discount_reason: parsed.data.discount_reason,
    notes: parsed.data.notes,
  };

  const { data, error } = await supabase
    .from("enrollments")
    .insert(payload)
    .select("id, student_id, class_id, status, start_date")
    .single();

  if (error || !data) {
    console.error("Enrollment insert error:", {
      error,
      payload,
    });

    return {
      message: error
        ? `Não foi possível criar a matrícula: ${error.message}`
        : "Não foi possível criar a matrícula.",
    };
  }

  if (data.status === "active") {
    await ensureGrowthChurnEvent({
      supabase,
      enrollmentId: data.id as string,
      eventType: "entrada",
      eventDate: (data.start_date as string | null) ?? null,
      source: "enrollment_created",
    });
  }

  revalidatePath("/matriculas");
  revalidatePath("/dashboard");
  revalidatePath("/financeiro/growth-churn");
  revalidatePath(`/alunos/${data.student_id}`);
  revalidatePath(`/turmas/${data.class_id}`);
  redirect(
    parsed.data.financial_guardian_id
      ? "/matriculas"
      : "/matriculas?created=without-financial-guardian",
  );
}

export async function cancelEnrollment(
  _previousState: EnrollmentActionState,
  formData: FormData,
): Promise<EnrollmentActionState> {
  const parsed = cancelEnrollmentSchema.safeParse({
    enrollment_id: String(formData.get("enrollment_id") ?? ""),
    cancellation_reason: String(formData.get("cancellation_reason") ?? ""),
    cancellation_notes:
      String(formData.get("cancellation_notes") ?? "").trim() || null,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os dados do cancelamento.",
    };
  }

  const supabase = await createClient();
  const { data: enrollment, error: loadError } = await supabase
    .from("enrollments")
    .select("id, student_id, class_id, status, monthly_amount")
    .eq("id", parsed.data.enrollment_id)
    .maybeSingle();

  if (loadError || !enrollment) {
    console.error("Cancel enrollment load error:", loadError);
    return {
      message:
        loadError?.message ??
        "Não foi possível localizar a matrícula para cancelamento.",
    };
  }

  if (enrollment.status === "cancelled") {
    return {
      message: "Esta matrícula já está cancelada.",
    };
  }

  if (enrollment.status !== "active") {
    return {
      message: "Apenas matrículas ativas podem ser canceladas.",
    };
  }

  const cancelledAt = new Date().toISOString();
  const { error } = await supabase
    .from("enrollments")
    .update({
      status: "cancelled",
      cancellation_reason: parsed.data.cancellation_reason,
      cancellation_notes: parsed.data.cancellation_notes,
      cancelled_at: cancelledAt,
    })
    .eq("id", parsed.data.enrollment_id);

  if (error) {
    console.error("Cancel enrollment update error:", {
      error,
      enrollmentId: parsed.data.enrollment_id,
    });

    return {
      message: `Não foi possível cancelar a matrícula: ${error.message}`,
    };
  }

  const studentId = enrollment.student_id as string | null;
  const classId = enrollment.class_id as string | null;
  const previousStatus = enrollment.status as string | null;

  const { error: logError } = await supabase.from("enrollment_logs").insert({
    enrollment_id: parsed.data.enrollment_id,
    student_id: studentId,
    class_id: classId,
    event_type: "enrollment_cancelled",
    reason: parsed.data.cancellation_reason,
    notes: parsed.data.cancellation_notes,
    previous_status: previousStatus,
    new_status: "cancelled",
    created_at: cancelledAt,
  });

  if (logError) {
    console.error("Cancel enrollment log insert error:", {
      error: logError,
      enrollmentId: parsed.data.enrollment_id,
    });

    return {
      message: `A matrícula foi cancelada, mas não foi possível registrar o log: ${logError.message}`,
    };
  }

  await ensureGrowthChurnEvent({
    supabase,
    enrollmentId: parsed.data.enrollment_id,
    eventType: "saida",
    eventDate: cancelledAt,
    reasonName: parsed.data.cancellation_reason,
    reasonNotes: parsed.data.cancellation_notes,
    source: "enrollment_cancelled",
  });

  revalidatePath("/turmas");
  revalidatePath("/matriculas");
  revalidatePath("/dashboard");
  revalidatePath("/financeiro/growth-churn");
  revalidatePath("/alunos");

  if (studentId) {
    revalidatePath(`/alunos/${studentId}`);
  }

  if (classId) {
    revalidatePath(`/turmas/${classId}`);
  }

  return {
    success: true,
    message: "Matrícula cancelada com sucesso.",
  };
}
