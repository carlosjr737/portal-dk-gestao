import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * As métricas por professor, turma, modalidade e nível.
 *
 * ┌─ O NOME VAI JUNTO, SEMPRE ──────────────────────────────────────────┐
 * │ Cada linha carrega `entidade_nome` — como a coisa se chamava NAQUELE │
 * │ mês. Guardar só o id e resolver o nome na hora de mostrar pareceria  │
 * │ mais limpo e mentiria duas vezes: turma renomeada apareceria com o   │
 * │ nome novo em meses antigos, e turma APAGADA sumiria do histórico     │
 * │ inteiro, levando junto a receita que ela de fato gerou.              │
 * └─────────────────────────────────────────────────────────────────────┘
 */

const STATUS_MATRICULA_ATIVA = "active";
const STATUS_TURMA_ATIVA = "active";

/** school-metrics/queries.ts:200 — a definição oficial de receita. */
function valorLiquido(bruto: unknown, desconto: unknown): number {
  return Math.max(0, Number(bruto ?? 0) - Number(desconto ?? 0));
}

const arredonda = (n: number) => Number(n.toFixed(2));

export type Dimensao = "professor" | "turma" | "modalidade" | "nivel";

export type LinhaMetrica = {
  dimensao: Dimensao | "escola";
  entidadeId: string;
  entidadeNome: string;
  metrica: string;
  valor: number;
};

/** Rótulos das métricas dimensionadas, para a tela não precisar adivinhar. */
export const METRICAS_DIMENSAO: Record<string, { rotulo: string; formato: string }> = {
  turmas: { rotulo: "Turmas", formato: "numero" },
  matriculas: { rotulo: "Matrículas", formato: "numero" },
  alunos: { rotulo: "Alunos distintos", formato: "numero" },
  receita_liquida: { rotulo: "Receita", formato: "dinheiro" },
  desconto: { rotulo: "Desconto", formato: "dinheiro" },
  capacidade: { rotulo: "Vagas", formato: "numero" },
  ocupacao: { rotulo: "Ocupação", formato: "porcentagem" },
  dna: { rotulo: "DNA do mês", formato: "nota" },
  dna_avaliacoes: { rotulo: "Aulas avaliadas", formato: "numero" },
};

type Acumulador = {
  nome: string;
  turmas: Set<string>;
  matriculas: number;
  alunos: Set<string>;
  receita: number;
  desconto: number;
  capacidade: number;
};

const novo = (nome: string): Acumulador => ({
  nome,
  turmas: new Set(),
  matriculas: 0,
  alunos: new Set(),
  receita: 0,
  desconto: 0,
  capacidade: 0,
});

/**
 * Calcula tudo numa passada só.
 *
 * Quatro dimensões saem das MESMAS linhas de matrícula: separá-las em quatro
 * funções significaria ler a tabela quatro vezes para chegar no mesmo número.
 */
export async function calcularDimensoes(
  escolaId: string,
  competencia: string,
): Promise<LinhaMetrica[]> {
  const admin = createAdminClient();

  const [turmasRes, matriculasRes, equipeRes, modalidadesRes, niveisRes] =
    await Promise.all([
      admin
        .from("classes")
        .select("id, name, capacity, status, teacher_id, modality_id, level_id")
        .eq("escola_id", escolaId)
        .eq("status", STATUS_TURMA_ATIVA),
      admin
        .from("enrollments")
        .select("class_id, student_id, monthly_amount, discount_amount")
        .eq("escola_id", escolaId)
        .eq("status", STATUS_MATRICULA_ATIVA),
      admin.from("staff_members").select("id, full_name, artistic_name").eq("escola_id", escolaId),
      admin.from("modalities").select("id, name").eq("escola_id", escolaId),
      admin.from("levels").select("id, name").eq("escola_id", escolaId),
    ]);

  const turmas = turmasRes.data ?? [];
  const matriculas = matriculasRes.data ?? [];

  /*
   * O nome do professor prefere o ARTÍSTICO. É por ele que a escola conhece
   * a pessoa, e é o que aparece nas outras telas — histórico com nome
   * diferente do resto do sistema não se reconhece.
   */
  const nomeProfessor = new Map(
    (equipeRes.data ?? []).map((p) => [
      p.id as string,
      ((p.artistic_name as string | null)?.trim() || (p.full_name as string | null) || "Sem nome"),
    ]),
  );
  const nomeModalidade = new Map(
    (modalidadesRes.data ?? []).map((m) => [m.id as string, (m.name as string) ?? "Sem nome"]),
  );
  const nomeNivel = new Map(
    (niveisRes.data ?? []).map((n) => [n.id as string, (n.name as string) ?? "Sem nome"]),
  );

  const porProfessor = new Map<string, Acumulador>();
  const porTurma = new Map<string, Acumulador>();
  const porModalidade = new Map<string, Acumulador>();
  const porNivel = new Map<string, Acumulador>();

  const turmaPorId = new Map(turmas.map((t) => [t.id as string, t]));

  // Turmas primeiro: turma sem matrícula PRECISA aparecer, com zero. Turma
  // vazia some do relatório é justamente a que a escola precisa enxergar.
  for (const t of turmas) {
    const id = t.id as string;
    const acc = novo((t.name as string) ?? "Sem nome");
    acc.turmas.add(id);
    acc.capacidade = Number(t.capacity ?? 0);
    porTurma.set(id, acc);

    const registra = (
      mapa: Map<string, Acumulador>,
      chave: string | null,
      nome: string,
    ) => {
      if (!chave) return;
      const a = mapa.get(chave) ?? novo(nome);
      a.turmas.add(id);
      a.capacidade += Number(t.capacity ?? 0);
      mapa.set(chave, a);
    };

    const profId = t.teacher_id as string | null;
    registra(porProfessor, profId, profId ? (nomeProfessor.get(profId) ?? "Sem nome") : "");
    const modId = t.modality_id as string | null;
    registra(porModalidade, modId, modId ? (nomeModalidade.get(modId) ?? "Sem nome") : "");
    const nivId = t.level_id as string | null;
    registra(porNivel, nivId, nivId ? (nomeNivel.get(nivId) ?? "Sem nome") : "");
  }

  for (const m of matriculas) {
    const turma = turmaPorId.get(m.class_id as string);
    // Matrícula em turma inativa não entra: a foto é do que está rodando.
    if (!turma) continue;

    const liquido = valorLiquido(m.monthly_amount, m.discount_amount);
    const desconto = Number(m.discount_amount ?? 0);
    const aluno = m.student_id as string | null;

    const soma = (a: Acumulador | undefined) => {
      if (!a) return;
      a.matriculas += 1;
      a.receita += liquido;
      a.desconto += desconto;
      if (aluno) a.alunos.add(aluno);
    };

    soma(porTurma.get(turma.id as string));
    soma(porProfessor.get((turma.teacher_id as string) ?? ""));
    soma(porModalidade.get((turma.modality_id as string) ?? ""));
    soma(porNivel.get((turma.level_id as string) ?? ""));
  }

  const linhas: LinhaMetrica[] = [];

  const despeja = (dimensao: Dimensao, mapa: Map<string, Acumulador>) => {
    for (const [id, a] of mapa) {
      const base: Record<string, number> = {
        turmas: a.turmas.size,
        matriculas: a.matriculas,
        alunos: a.alunos.size,
        receita_liquida: arredonda(a.receita),
        desconto: arredonda(a.desconto),
        capacidade: a.capacidade,
        ocupacao:
          a.capacidade > 0 ? Number(((a.matriculas / a.capacidade) * 100).toFixed(1)) : 0,
      };
      for (const [metrica, valor] of Object.entries(base)) {
        linhas.push({ dimensao, entidadeId: id, entidadeNome: a.nome, metrica, valor });
      }
    }
  };

  despeja("professor", porProfessor);
  despeja("turma", porTurma);
  despeja("modalidade", porModalidade);
  despeja("nivel", porNivel);

  linhas.push(...(await dnaDoMes(escolaId, competencia, nomeProfessor)));

  return linhas;
}

/**
 * DNA médio por professor NO MÊS da competência.
 *
 * É a única métrica aqui que fotografa o mês de verdade em vez do "agora":
 * `teacher_dna_assessments` tem `lesson_date`, então dá para filtrar a
 * janela exata. As outras dependem de tabelas sem histórico próprio.
 *
 * Professor sem avaliação no mês NÃO entra com zero. Zero é uma nota — e
 * "não foi avaliado" não é "foi mal".
 */
async function dnaDoMes(
  escolaId: string,
  competencia: string,
  nomeProfessor: Map<string, string>,
): Promise<LinhaMetrica[]> {
  const admin = createAdminClient();
  const [ano, mes] = competencia.split("-").map(Number);
  const primeiro = `${competencia}-01`;
  const ultimo = new Date(ano, mes, 0);
  const fim = `${competencia}-${String(ultimo.getDate()).padStart(2, "0")}`;

  const { data, error } = await admin
    .from("teacher_dna_assessments")
    .select("teacher_id, overall_score")
    .eq("escola_id", escolaId)
    .gte("lesson_date", primeiro)
    .lte("lesson_date", fim)
    .not("overall_score", "is", null);

  if (error) {
    console.error("[metricas] DNA do mês falhou", { competencia, erro: error.message });
    return [];
  }

  const soma = new Map<string, { total: number; n: number }>();
  for (const a of data ?? []) {
    const id = a.teacher_id as string | null;
    if (!id) continue;
    const atual = soma.get(id) ?? { total: 0, n: 0 };
    atual.total += Number(a.overall_score ?? 0);
    atual.n += 1;
    soma.set(id, atual);
  }

  const linhas: LinhaMetrica[] = [];
  for (const [id, { total, n }] of soma) {
    const nome = nomeProfessor.get(id) ?? "Sem nome";
    linhas.push({
      dimensao: "professor",
      entidadeId: id,
      entidadeNome: nome,
      metrica: "dna",
      valor: arredonda(total / n),
    });
    linhas.push({
      dimensao: "professor",
      entidadeId: id,
      entidadeNome: nome,
      metrica: "dna_avaliacoes",
      valor: n,
    });
  }
  return linhas;
}
