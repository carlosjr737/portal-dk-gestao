import { createClient } from "@/lib/supabase/server";

export type AudienceSlice = {
  label: string;
  count: number;
};

export type AudienceGrowthPoint = {
  /** "YYYY-MM" */
  month: string;
  label: string;
  count: number;
};

export type AudienceMetrics = {
  available: boolean;
  totalActiveStudents: number;
  totalFamilies: number;
  averageAge: number | null;
  dominantAgeBand: string | null;
  modalitiesCount: number;
  ageInvalidCount: number;
  ageBands: AudienceSlice[];
  byModality: AudienceSlice[];
  byLevel: AudienceSlice[];
  familySizes: AudienceSlice[];
  growth: AudienceGrowthPoint[];
};

type StudentRow = {
  id: string;
  birth_date: string | null;
  created_at: string | null;
};

type EnrollmentRow = {
  student_id: string;
  class_id: string | null;
  status: string;
  financial_guardian_id: string | null;
};

type ClassRow = {
  id: string;
  modality_id: string | null;
  level_id: string | null;
};

type CatalogRow = { id: string; name: string; sort_order?: number | null };

const emptyMetrics: AudienceMetrics = {
  available: false,
  totalActiveStudents: 0,
  totalFamilies: 0,
  averageAge: null,
  dominantAgeBand: null,
  modalitiesCount: 0,
  ageInvalidCount: 0,
  ageBands: [],
  byModality: [],
  byLevel: [],
  familySizes: [],
  growth: [],
};

// Faixas etárias. Idades acima de 80 são tratadas como cadastro inválido
// (ex.: data de nascimento digitada errada) e contadas à parte.
const AGE_BANDS: { label: string; min: number; max: number }[] = [
  { label: "4 a 6", min: 0, max: 6 },
  { label: "7 a 9", min: 7, max: 9 },
  { label: "10 a 12", min: 10, max: 12 },
  { label: "13 a 15", min: 13, max: 15 },
  { label: "16 a 18", min: 16, max: 18 },
  { label: "19 a 25", min: 19, max: 25 },
  { label: "26+", min: 26, max: 80 },
];

const MAX_VALID_AGE = 80;

const MONTH_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) {
    return null;
  }
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export async function getAudienceMetrics(): Promise<AudienceMetrics> {
  try {
    const supabase = await createClient();

    const [
      studentsResult,
      enrollmentsResult,
      classesResult,
      modalitiesResult,
      levelsResult,
    ] = await Promise.all([
      supabase.from("students").select("id, birth_date, created_at"),
      supabase
        .from("enrollments")
        .select("student_id, class_id, status, financial_guardian_id"),
      supabase.from("classes").select("id, modality_id, level_id"),
      supabase.from("modalities").select("id, name, sort_order"),
      supabase.from("levels").select("id, name, sort_order"),
    ]);

    const firstError =
      studentsResult.error ??
      enrollmentsResult.error ??
      classesResult.error ??
      modalitiesResult.error ??
      levelsResult.error;

    if (firstError) {
      console.error("Audience metrics load error:", firstError.message);
      return emptyMetrics;
    }

    const students = (studentsResult.data ?? []) as StudentRow[];
    const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[];
    const classes = (classesResult.data ?? []) as ClassRow[];
    const modalities = (modalitiesResult.data ?? []) as CatalogRow[];
    const levels = (levelsResult.data ?? []) as CatalogRow[];

    const studentsById = new Map(students.map((s) => [s.id, s]));
    const classesById = new Map(classes.map((c) => [c.id, c]));
    const modalityNameById = new Map(modalities.map((m) => [m.id, m.name]));
    const levelNameById = new Map(levels.map((l) => [l.id, l.name]));

    // Público = alunos com matrícula ATIVA (distintos).
    const activeStudentIds = new Set<string>();
    // Família = responsável financeiro distinto entre as matrículas ativas.
    // Guarda os alunos distintos de cada família para medir nº de filhos.
    const studentsByFamily = new Map<string, Set<string>>();
    // student -> conjunto de modalidades/níveis (distintos por aluno).
    const modalityByStudent = new Map<string, Set<string>>();
    const levelByStudent = new Map<string, Set<string>>();

    for (const enrollment of enrollments) {
      if (enrollment.status !== "active" || !enrollment.student_id) {
        continue;
      }
      activeStudentIds.add(enrollment.student_id);

      if (enrollment.financial_guardian_id) {
        if (!studentsByFamily.has(enrollment.financial_guardian_id)) {
          studentsByFamily.set(enrollment.financial_guardian_id, new Set());
        }
        studentsByFamily
          .get(enrollment.financial_guardian_id)!
          .add(enrollment.student_id);
      }

      const danceClass = enrollment.class_id
        ? classesById.get(enrollment.class_id)
        : undefined;
      if (!danceClass) {
        continue;
      }

      if (danceClass.modality_id) {
        const name =
          modalityNameById.get(danceClass.modality_id) ?? "Sem modalidade";
        if (!modalityByStudent.has(enrollment.student_id)) {
          modalityByStudent.set(enrollment.student_id, new Set());
        }
        modalityByStudent.get(enrollment.student_id)!.add(name);
      }

      if (danceClass.level_id) {
        const name = levelNameById.get(danceClass.level_id) ?? "Sem nível";
        if (!levelByStudent.has(enrollment.student_id)) {
          levelByStudent.set(enrollment.student_id, new Set());
        }
        levelByStudent.get(enrollment.student_id)!.add(name);
      }
    }

    const totalActiveStudents = activeStudentIds.size;

    if (totalActiveStudents === 0) {
      return { ...emptyMetrics, available: true };
    }

    // ----- Faixa etária -----
    const bandCounts = new Map<string, number>(
      AGE_BANDS.map((band) => [band.label, 0]),
    );
    let ageSum = 0;
    let ageValidCount = 0;
    let ageInvalidCount = 0;

    for (const studentId of activeStudentIds) {
      const student = studentsById.get(studentId);
      const age = ageFromBirthDate(student?.birth_date ?? null);
      if (age === null || age < 0 || age > MAX_VALID_AGE) {
        ageInvalidCount += 1;
        continue;
      }
      ageSum += age;
      ageValidCount += 1;
      const band = AGE_BANDS.find((b) => age >= b.min && age <= b.max);
      if (band) {
        bandCounts.set(band.label, (bandCounts.get(band.label) ?? 0) + 1);
      }
    }

    const ageBands: AudienceSlice[] = AGE_BANDS.map((band) => ({
      label: band.label,
      count: bandCounts.get(band.label) ?? 0,
    })).filter((slice) => slice.count > 0);

    const averageAge =
      ageValidCount > 0
        ? Math.round((ageSum / ageValidCount) * 10) / 10
        : null;

    const dominantAgeBand =
      ageBands.length > 0
        ? ageBands.reduce((max, slice) =>
            slice.count > max.count ? slice : max,
          ).label
        : null;

    // ----- Por modalidade (alunos distintos) -----
    const modalityCounts = new Map<string, number>();
    for (const set of modalityByStudent.values()) {
      for (const name of set) {
        modalityCounts.set(name, (modalityCounts.get(name) ?? 0) + 1);
      }
    }
    const byModality: AudienceSlice[] = Array.from(modalityCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    // ----- Por nível (alunos distintos) -----
    const levelCounts = new Map<string, number>();
    for (const set of levelByStudent.values()) {
      for (const name of set) {
        levelCounts.set(name, (levelCounts.get(name) ?? 0) + 1);
      }
    }
    const byLevel: AudienceSlice[] = Array.from(levelCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    // ----- Famílias por nº de filhos (alunos ativos distintos) -----
    let fam1 = 0;
    let fam2 = 0;
    let fam3plus = 0;
    for (const set of studentsByFamily.values()) {
      if (set.size === 1) {
        fam1 += 1;
      } else if (set.size === 2) {
        fam2 += 1;
      } else {
        fam3plus += 1;
      }
    }
    const familySizes: AudienceSlice[] = [
      { label: "1 filho", count: fam1 },
      { label: "2 filhos", count: fam2 },
      { label: "3+ filhos", count: fam3plus },
    ].filter((slice) => slice.count > 0);

    // ----- Crescimento: novos alunos por mês (últimos 12 meses) -----
    const now = new Date();
    const growthBuckets: AudienceGrowthPoint[] = [];
    const bucketIndex = new Map<string, number>();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      bucketIndex.set(key, growthBuckets.length);
      growthBuckets.push({
        month: key,
        label: `${MONTH_LABELS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        count: 0,
      });
    }

    for (const studentId of activeStudentIds) {
      const student = studentsById.get(studentId);
      if (!student?.created_at) {
        continue;
      }
      const created = new Date(student.created_at);
      if (Number.isNaN(created.getTime())) {
        continue;
      }
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      const idx = bucketIndex.get(key);
      if (idx !== undefined) {
        growthBuckets[idx].count += 1;
      }
    }

    return {
      available: true,
      totalActiveStudents,
      totalFamilies: studentsByFamily.size,
      averageAge,
      dominantAgeBand,
      modalitiesCount: byModality.length,
      ageInvalidCount,
      ageBands,
      byModality,
      byLevel,
      familySizes,
      growth: growthBuckets,
    };
  } catch (error) {
    console.error(
      "Audience metrics load error:",
      error instanceof Error ? error.message : error,
    );
    return emptyMetrics;
  }
}
