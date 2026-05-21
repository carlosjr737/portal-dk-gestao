import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseClientLike = Pick<SupabaseClient, "from">;

type GrowthChurnEventType = "entrada" | "saida";

type EnsureGrowthChurnEventParams = {
  supabase: SupabaseClientLike;
  enrollmentId: string;
  eventType: GrowthChurnEventType;
  eventDate?: string | null;
  reasonName?: string | null;
  reasonNotes?: string | null;
  source: "enrollment_created" | "enrollment_cancelled";
};

type EnrollmentSnapshot = {
  id: string;
  student_id: string | null;
  class_id: string | null;
  start_date: string | null;
  monthly_amount: number | string | null;
  class:
    | {
        teacher_id?: string | null;
        modality_id?: string | null;
        level_id?: string | null;
      }
    | Array<{
        teacher_id?: string | null;
        modality_id?: string | null;
        level_id?: string | null;
      }>
    | null;
};

export async function ensureGrowthChurnEvent({
  supabase,
  enrollmentId,
  eventType,
  eventDate,
  reasonName,
  reasonNotes,
  source,
}: EnsureGrowthChurnEventParams) {
  const { data: existingEvent, error: existingError } = await supabase
    .from("growth_churn_events")
    .select("id")
    .eq("event_type", eventType)
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  if (existingError) {
    console.error("Growth churn duplicate check error:", existingError);
    return;
  }

  if (existingEvent) {
    return;
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select(
      "id, student_id, class_id, start_date, monthly_amount, class:classes!enrollments_class_id_fkey(teacher_id, modality_id, level_id)",
    )
    .eq("id", enrollmentId)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    console.error("Growth churn enrollment load error:", {
      error: enrollmentError,
      enrollmentId,
    });
    return;
  }

  const snapshot = enrollment as EnrollmentSnapshot;
  const danceClass = normalizeEnrollmentClass(snapshot.class);
  const reasonId =
    eventType === "saida"
      ? await getChurnReasonId(supabase, reasonName)
      : null;

  const { error: insertError } = await supabase
    .from("growth_churn_events")
    .insert({
      event_type: eventType,
      student_id: snapshot.student_id,
      enrollment_id: snapshot.id,
      class_id: snapshot.class_id,
      teacher_id: danceClass?.teacher_id ?? null,
      modality_id: danceClass?.modality_id ?? null,
      level_id: danceClass?.level_id ?? null,
      event_date:
        eventDate?.slice(0, 10) ||
        snapshot.start_date?.slice(0, 10) ||
        new Date().toISOString().slice(0, 10),
      monthly_amount: normalizeMoney(snapshot.monthly_amount),
      reason_id: reasonId,
      reason_notes: buildReasonNotes(reasonName, reasonNotes),
      source,
    });

  if (insertError) {
    console.error("Growth churn event insert error:", {
      error: insertError,
      enrollmentId,
      eventType,
    });
  }
}

async function getChurnReasonId(
  supabase: SupabaseClientLike,
  reasonName: string | null | undefined,
) {
  const preferredName = mapCancellationReasonToChurnReason(reasonName);
  const { data, error } = await supabase
    .from("churn_reasons")
    .select("id")
    .eq("name", preferredName)
    .maybeSingle();

  if (error) {
    console.error("Growth churn reason load error:", error);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}

function mapCancellationReasonToChurnReason(reasonName: string | null | undefined) {
  const normalizedReason = reasonName?.trim() ?? "";
  const directMap: Record<string, string> = {
    "Questão financeira": "Motivos Financeiros",
    "Questão de saúde": "Motivos de Saúde/Fisioterapia",
    "Incompatibilidade com agenda da família": "Incompatibilidade de Horários",
    "Mudança de horário": "Incompatibilidade de Horários",
    "Mudança de cidade/endereço": "Mudança de Localidade/Logística",
    "Falta de interesse do aluno": "Mudança de Interesses ou Desmotivação",
    "Falta de adaptação": "Mudança de Interesses ou Desmotivação",
    "Insatisfação com a aula": "Atendimento/Experiência",
    "Insatisfação com atendimento": "Atendimento/Experiência",
  };

  return directMap[normalizedReason] ?? (normalizedReason || "Outros");
}

function buildReasonNotes(
  reasonName: string | null | undefined,
  reasonNotes: string | null | undefined,
) {
  const parts = [
    reasonName ? `Motivo selecionado: ${reasonName}` : null,
    reasonNotes?.trim() || null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("\n") : null;
}

function normalizeEnrollmentClass(value: EnrollmentSnapshot["class"]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeMoney(value: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}
