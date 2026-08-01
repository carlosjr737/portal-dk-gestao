import { createClient } from "@/lib/supabase/server";
import { formatClassSchedules } from "@/features/classes/formatters";
import type { ClassSchedule } from "@/features/classes/types";

// ---- Parâmetros do contrato (ajuste aqui se a regra mudar) ----
// Fallback de nº de mensalidades quando não há Término na matrícula.
const QTD_MENSALIDADES_FALLBACK = 11;
// Regra confirmada com o cliente:
//  - Taxa de matrícula = valor da mensalidade bruta (com exceções manuais).
//  - Valor a pagar = mensalidade BRUTA (sem desconto e sem acréscimo de 2%).

export type ContractTurma = {
  modalidade: string;
  nivel: string;
  professor: string;
  diasHorario: string;
  inicio: string | null;
  termino: string | null;
  codigo: string;
};

export type ContractParcela = {
  referente: string;
  vencimento: string | null;
  bruto: number;
  desconto: number;
  valorPagar: number;
};

export type StudentContract = {
  available: boolean;
  student: { fullName: string; document: string | null };
  guardian: {
    fullName: string;
    document: string | null;
    address: string | null;
  } | null;
  turmas: ContractTurma[];
  payment: {
    mensalidadeBruta: number;
    mensalidadeDesconto: number;
    mensalidadeLiquida: number;
    parcelas: ContractParcela[];
  };
};

const emptyContract: StudentContract = {
  available: false,
  student: { fullName: "", document: null },
  guardian: null,
  turmas: [],
  payment: {
    mensalidadeBruta: 0,
    mensalidadeDesconto: 0,
    mensalidadeLiquida: 0,
    parcelas: [],
  },
};

type EnrollmentRow = {
  id: string;
  class_id: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  financial_guardian_id: string | null;
  first_due_date: string | null;
  monthly_amount: number | string | null;
  discount_amount: number | string | null;
};

function money(value: number | string | null): number {
  return Number(value ?? 0) || 0;
}

/** Nº de meses entre o 1º vencimento e o Término (inclusive). */
function monthsBetweenInclusive(
  firstDue: string | null,
  end: string | null,
): number | null {
  if (!firstDue || !end) return null;
  const [fy, fm] = firstDue.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  if (!fy || !fm || !ey || !em) return null;
  const n = ey * 12 + em - (fy * 12 + fm) + 1;
  return n > 0 ? n : 0;
}

/** Gera os vencimentos mensais a partir de uma data-base, no mesmo dia do mês. */
function monthlyDueDates(firstDue: string | null, count: number): string[] {
  if (!firstDue) {
    return Array.from({ length: count }, () => "");
  }
  const [y, m, d] = firstDue.split("-").map(Number);
  if (!y || !m || !d) {
    return Array.from({ length: count }, () => "");
  }
  const dates: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = new Date(y, m - 1 + i, 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const day = Math.min(d, lastDay);
    dates.push(
      `${String(day).padStart(2, "0")}/${String(base.getMonth() + 1).padStart(2, "0")}/${base.getFullYear()}`,
    );
  }
  return dates;
}

export async function getStudentContract(
  studentId: string,
): Promise<StudentContract> {
  try {
    const supabase = await createClient();

    const [
      { data: student, error: studentError },
      { data: enrollments, error: enrollmentsError },
    ] = await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, document")
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select(
          "id, class_id, status, start_date, end_date, financial_guardian_id, first_due_date, monthly_amount, discount_amount",
        )
        .eq("student_id", studentId)
        .eq("status", "active"),
    ]);

    if (studentError || !student) {
      if (studentError) console.error("Contract student error:", studentError);
      return emptyContract;
    }

    const activeEnrollments = (enrollments ?? []) as EnrollmentRow[];
    if (enrollmentsError) {
      console.error("Contract enrollments error:", enrollmentsError);
    }

    const classIds = [
      ...new Set(
        activeEnrollments
          .map((e) => e.class_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const guardianId =
      activeEnrollments.find((e) => e.financial_guardian_id)
        ?.financial_guardian_id ?? null;

    const [
      { data: classes },
      { data: schedules },
      { data: modalities },
      { data: levels },
      { data: teachers },
      { data: guardian },
    ] = await Promise.all([
      classIds.length
        ? supabase
            .from("classes")
            .select(
              "id, name, category, modality_id, level_id, teacher_id, instructor_name",
            )
            .in("id", classIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      classIds.length
        ? supabase
            .from("class_schedules")
            .select("id, class_id, weekday, start_time, end_time, room")
            .in("class_id", classIds)
        : Promise.resolve({ data: [] as ClassSchedule[] }),
      supabase.from("modalities").select("id, name"),
      supabase.from("levels").select("id, name"),
      supabase.from("staff_members").select("id, full_name, artistic_name"),
      guardianId
        ? supabase
            .from("guardians")
            .select("id, full_name, document, address")
            .eq("id", guardianId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const modalityById = new Map(
      (modalities ?? []).map((m) => [m.id as string, m.name as string]),
    );
    const levelById = new Map(
      (levels ?? []).map((l) => [l.id as string, l.name as string]),
    );
    const teacherById = new Map(
      (teachers ?? []).map((t) => [
        t.id as string,
        ((t.artistic_name as string | null) || (t.full_name as string)) ?? "",
      ]),
    );
    const schedulesByClass = new Map<string, ClassSchedule[]>();
    for (const s of (schedules ?? []) as ClassSchedule[]) {
      const list = schedulesByClass.get(s.class_id) ?? [];
      list.push(s);
      schedulesByClass.set(s.class_id, list);
    }
    const classById = new Map(
      (classes ?? []).map((c) => [c.id as string, c]),
    );

    const turmas: ContractTurma[] = activeEnrollments
      .map((enrollment) => {
        const danceClass = enrollment.class_id
          ? classById.get(enrollment.class_id)
          : null;
        if (!danceClass) return null;
        const modalidade =
          (danceClass.modality_id
            ? modalityById.get(danceClass.modality_id as string)
            : null) ??
          (danceClass.category as string | null) ??
          "";
        const nivel = danceClass.level_id
          ? levelById.get(danceClass.level_id as string) ?? ""
          : "";
        const professor = danceClass.teacher_id
          ? teacherById.get(danceClass.teacher_id as string) ?? ""
          : ((danceClass.instructor_name as string | null) ?? "");
        const sched = schedulesByClass.get(enrollment.class_id as string) ?? [];
        return {
          modalidade: modalidade.toUpperCase(),
          nivel: nivel.toUpperCase(),
          professor: professor.toUpperCase(),
          diasHorario: sched.length ? formatClassSchedules(sched) : "-",
          inicio: enrollment.start_date,
          termino: enrollment.end_date,
          codigo: enrollment.id.slice(0, 8).toUpperCase(),
        };
      })
      .filter((t): t is ContractTurma => t !== null);

    // ---- Pagamento (Cláusula 3ª) ----
    const mensalidadeBruta = activeEnrollments.reduce(
      (sum, e) => sum + money(e.monthly_amount),
      0,
    );
    const mensalidadeDesconto = activeEnrollments.reduce(
      (sum, e) => sum + money(e.discount_amount),
      0,
    );
    const mensalidadeLiquida = Math.max(
      0,
      mensalidadeBruta - mensalidadeDesconto,
    );

    const firstDue =
      activeEnrollments.find((e) => e.first_due_date)?.first_due_date ?? null;
    const matriculaVenc =
      activeEnrollments.find((e) => e.start_date)?.start_date ?? null;
    // Nº de mensalidades = do 1º vencimento até o Término da matrícula (Cláusula 2ª).
    const termino = activeEnrollments.reduce<string | null>((max, e) => {
      if (!e.end_date) return max;
      return !max || e.end_date > max ? e.end_date : max;
    }, null);
    const count =
      monthsBetweenInclusive(firstDue, termino) ?? QTD_MENSALIDADES_FALLBACK;
    const dueDates = monthlyDueDates(firstDue, count);

    const parcelas: ContractParcela[] = [
      {
        referente: "MATRÍCULA",
        vencimento: matriculaVenc
          ? matriculaVenc.split("-").reverse().join("/")
          : null,
        // Matrícula = valor da mensalidade bruta (exceções ajustadas à mão).
        bruto: mensalidadeBruta,
        desconto: 0,
        valorPagar: mensalidadeBruta,
      },
      ...dueDates.map((venc) => ({
        referente: "MENSALIDADE",
        vencimento: venc || null,
        // Valor a pagar = bruto (sem desconto, sem +2%).
        bruto: mensalidadeBruta,
        desconto: mensalidadeDesconto,
        valorPagar: mensalidadeBruta,
      })),
    ];

    return {
      available: true,
      student: {
        fullName: student.full_name as string,
        document: (student.document as string | null) ?? null,
      },
      guardian: guardian
        ? {
            fullName: guardian.full_name as string,
            document: (guardian.document as string | null) ?? null,
            address: (guardian.address as string | null) ?? null,
          }
        : null,
      turmas,
      payment: {
        mensalidadeBruta,
        mensalidadeDesconto,
        mensalidadeLiquida,
        parcelas,
      },
    };
  } catch (error) {
    console.error(
      "Contract load error:",
      error instanceof Error ? error.message : error,
    );
    return emptyContract;
  }
}
