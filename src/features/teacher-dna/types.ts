import type {
  TeacherDnaPeriod,
  TeacherDnaPillarKey,
  TeacherDnaStatusFilter,
} from "@/features/teacher-dna/constants";

export type TeacherDnaFilters = {
  period: TeacherDnaPeriod;
  teacherId: string;
  modalityId: string;
  levelId: string;
  status: TeacherDnaStatusFilter;
};

export type TeacherDnaTeacher = {
  id: string;
  full_name: string;
  artistic_name: string | null;
  photo_path: string | null;
  status: string;
};

export type TeacherDnaAssessment = {
  id: string;
  teacher_id: string;
  class_id: string | null;
  lesson_date: string | null;
  source: string;
  overall_score: number;
  pillar_scores: Partial<Record<TeacherDnaPillarKey, number>>;
  strengths: string[] | null;
  improvements: string[] | null;
  summary: string | null;
  created_at: string;
};

export type TeacherDnaClass = {
  id: string;
  name: string;
  teacher_id: string | null;
  modality_id: string | null;
  level_id: string | null;
};

export type TeacherDnaCatalogOption = {
  id: string;
  name: string;
};

export type TeacherDnaTeacherScore = {
  teacher: TeacherDnaTeacher;
  assessments: TeacherDnaAssessment[];
  evaluatedLessons: number;
  overallScore: number | null;
  pillarScores: Record<TeacherDnaPillarKey, number | null>;
  bestPillar: { key: TeacherDnaPillarKey; name: string; score: number } | null;
  attentionPillar: { key: TeacherDnaPillarKey; name: string; score: number } | null;
  trend: "up" | "down" | "stable" | "none";
  lastAssessmentDate: string | null;
};

export type TeacherDnaDashboardData = {
  filters: TeacherDnaFilters;
  teachers: TeacherDnaTeacher[];
  modalities: TeacherDnaCatalogOption[];
  levels: TeacherDnaCatalogOption[];
  teacherScores: TeacherDnaTeacherScore[];
  teamAverage: number | null;
  highlightedTeacher: TeacherDnaTeacherScore | null;
  strongestPillar: { key: TeacherDnaPillarKey; name: string; score: number } | null;
  criticalPillar: { key: TeacherDnaPillarKey; name: string; score: number } | null;
  evaluatedTeachersCount: number;
  assessedLessonsCount: number;
  teamPillarScores: Record<TeacherDnaPillarKey, number | null>;
  monthlyEvolution: Array<{ label: string; score: number | null }>;
  assessmentsTableAvailable: boolean;
};
