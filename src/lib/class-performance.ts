export type ClassPerformanceKey =
  | "cti"
  | "recovery"
  | "high"
  | "high_performance";

export type ClassPerformanceTone =
  | "danger"
  | "warning"
  | "success"
  | "premium";

export type ClassPerformanceStatus = {
  key: ClassPerformanceKey;
  label: string;
  description: string;
  tone: ClassPerformanceTone;
};

export function getClassPerformanceStatus(
  activeStudentsCount: number,
): ClassPerformanceStatus {
  const count = Math.max(0, activeStudentsCount);

  if (count <= 5) {
    return {
      key: "cti",
      label: "CTI",
      description: "Turma com até 5 alunos ativos.",
      tone: "danger",
    };
  }

  if (count <= 10) {
    return {
      key: "recovery",
      label: "Em recuperação",
      description: "Turma com 6 a 10 alunos ativos.",
      tone: "warning",
    };
  }

  if (count <= 15) {
    return {
      key: "high",
      label: "Em alta",
      description: "Turma com 11 a 15 alunos ativos.",
      tone: "success",
    };
  }

  return {
    key: "high_performance",
    label: "Alta performance",
    description: "Turma com 16 ou mais alunos ativos.",
    tone: "premium",
  };
}
