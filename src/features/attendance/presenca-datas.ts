import type { ClassScheduleWeekday } from "@/features/classes/schemas";

/**
 * Datas de aula de uma turma num mês.
 *
 * A grade impressa já calculava isso, mas devolvia "05/08" — bom para o papel,
 * inútil para gravar. Aqui a data sai em ISO (2026-08-05), que é o que vai
 * para o banco, com o rótulo junto para a tela não ter que reformatar.
 *
 * Fica em arquivo próprio porque é usado pela chamada digital E pela grade
 * impressa, e nenhuma das duas deve depender da outra.
 */

export type DataDeAula = {
  /** 2026-08-05 — o que vai para o banco. */
  iso: string;
  /** 05/08 — o que aparece na tela. */
  label: string;
  /** Seg, Ter… — ajuda quando a turma tem mais de um dia na semana. */
  diaDaSemana: string;
};

const DIA_JS: Record<ClassScheduleWeekday, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const ROTULO_DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function mesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export function normalizarMes(valor: string | undefined) {
  return valor && /^\d{4}-\d{2}$/.test(valor) ? valor : mesAtual();
}

export function datasDeAula(
  diasDaSemana: ClassScheduleWeekday[],
  mes: string,
): DataDeAula[] {
  const [anoTexto, mesTexto] = normalizarMes(mes).split("-");
  const ano = Number(anoTexto);
  const indiceDoMes = Number(mesTexto) - 1;

  const alvos = new Set(diasDaSemana.map((d) => DIA_JS[d]));
  if (alvos.size === 0) return [];

  const ultimoDia = new Date(ano, indiceDoMes + 1, 0).getDate();
  const datas: DataDeAula[] = [];

  for (let dia = 1; dia <= ultimoDia; dia += 1) {
    // Data local, não UTC: `new Date("2026-08-05")` é meia-noite em UTC, o que
    // no Brasil cai no dia 4. Construindo com (ano, mês, dia) o dia é o dia.
    const data = new Date(ano, indiceDoMes, dia);
    if (!alvos.has(data.getDay())) continue;

    const mm = String(indiceDoMes + 1).padStart(2, "0");
    const dd = String(dia).padStart(2, "0");
    datas.push({
      iso: `${ano}-${mm}-${dd}`,
      label: `${dd}/${mm}`,
      diaDaSemana: ROTULO_DIA[data.getDay()],
    });
  }

  return datas;
}

/** Hoje em ISO, no fuso local. */
export function hojeISO() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}
