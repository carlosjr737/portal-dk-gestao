import "server-only";

import ExcelJS from "exceljs";

import { PLATFORM_NAME } from "@/lib/branding";
import type { TeacherPaymentData } from "@/features/teacher-payments/queries";

const MONEY = '"R$"\\ #,##0.00';
const BLACK = "FF1A1A1A";
const BLUE = "FF2F5496";
const GREEN = "FFC6EFCE";
const GREENTX = "FF1B5E20";
const ZEBRA = "FFF3F6FB";

function fill(color: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: color } };
}
const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFBFBFBF" } },
  bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
  left: { style: "thin", color: { argb: "FFBFBFBF" } },
  right: { style: "thin", color: { argb: "FFBFBFBF" } },
};
const whiteBold = { bold: true, color: { argb: "FFFFFFFF" } } as const;

/** Célula com fórmula do Excel + resultado pré-calculado (abre certo em qualquer visualizador). */
function formula(f: string, result: number): ExcelJS.CellFormulaValue {
  return { formula: f, result };
}

function safeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/*?:[\]]/g, "").slice(0, 28) || "Prof";
  let n = base;
  let i = 2;
  while (used.has(n)) n = `${base} ${i++}`.slice(0, 31);
  used.add(n);
  return n;
}

/** Referência à aba para usar em fórmula (aspas + escape de aspas internas). */
function sheetRef(sheetName: string, cell: string): string {
  return `'${sheetName.replace(/'/g, "''")}'!${cell}`;
}

type ProfMeta = {
  professor: string;
  turmas: number;
  total: number;
  totalRef: string; // ex.: 'Ruan Lopes'!D48
};

export async function buildTeacherPaymentsWorkbook(
  data: TeacherPaymentData,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = PLATFORM_NAME;
  wb.calcProperties.fullCalcOnLoad = true; // Excel recalcula as fórmulas ao abrir

  // RESUMO fica como primeira aba, mas é preenchido DEPOIS (pra referenciar as abas).
  const rs = wb.addWorksheet("RESUMO", { views: [{ showGridLines: false }] });

  // ============ uma aba por professor ============
  const used = new Set<string>(["RESUMO"]);
  const meta: ProfMeta[] = [];

  for (const p of data.professores) {
    const sheetName = safeSheetName(p.professor, used);
    const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] });
    ws.columns = [
      { width: 5 }, { width: 16 }, { width: 14 }, { width: 13 },
      { width: 11 }, { width: 10 }, { width: 16 },
    ];
    let row = 1;
    const turmaTotalRefs: string[] = [];

    for (const t of p.turmas) {
      // barra preta: PROFESSOR / TURMA / NÍVEL / HORÁRIO / ANO
      const h1 = ws.getRow(row);
      ["", "PROFESSOR", "TURMA", "NÍVEL", "HORÁRIO", "ANO"].forEach((v, i) => {
        const c = h1.getCell(i + 1);
        if (i === 0) return;
        c.value = v;
        c.fill = fill(BLACK);
        c.font = whiteBold;
        c.alignment = { horizontal: "center" };
        c.border = thin;
      });
      row += 1;
      const d1 = ws.getRow(row);
      [p.professor, t.diasLabel, t.nivel, t.horario, 2026].forEach((v, i) => {
        const c = d1.getCell(i + 2);
        c.value = v as string | number;
        c.alignment = { horizontal: "center" };
        c.border = thin;
      });
      row += 2;

      // NOME (merge B:F) + CONDIÇÃO
      ws.mergeCells(`B${row}:F${row}`);
      const nh = ws.getRow(row);
      nh.getCell(2).value = "NOME";
      nh.getCell(7).value = "CONDIÇÃO";
      for (const ci of [1, 2, 7]) {
        nh.getCell(ci).fill = fill(BLACK);
        nh.getCell(ci).font = whiteBold;
        nh.getCell(ci).border = thin;
      }
      nh.getCell(7).alignment = { horizontal: "center" };
      row += 1;

      t.alunos.forEach((a, i) => {
        ws.mergeCells(`B${row}:F${row}`);
        const rr = ws.getRow(row);
        rr.getCell(1).value = i + 1;
        rr.getCell(1).alignment = { horizontal: "center" };
        rr.getCell(2).value = a.nome;
        rr.getCell(7).value = a.condicao;
        rr.getCell(7).alignment = { horizontal: "center" };
        for (const ci of [1, 2, 7]) {
          rr.getCell(ci).border = thin;
          if (i % 2 === 1) rr.getCell(ci).fill = fill(ZEBRA);
        }
        row += 1;
      });
      row += 1;

      // ---- ENTRADAS do cálculo (barra azul) ----
      const inH = ws.getRow(row);
      ["Hora aula", "Variável/aluno", "Nº Alunos", "Aulas/mês"].forEach((v, i) => {
        const c = inH.getCell(i + 2); // B, C, D, E
        c.value = v;
        c.fill = fill(BLUE);
        c.font = whiteBold;
        c.alignment = { horizontal: "center" };
        c.border = thin;
      });
      row += 1;
      const inRow = row; // linha com hora/variável/nAlunos/aulas (entradas)
      const inV = ws.getRow(row);
      inV.getCell(2).value = t.horaAula;
      inV.getCell(2).numFmt = MONEY;
      inV.getCell(3).value = t.valorAluno;
      inV.getCell(3).numFmt = MONEY;
      inV.getCell(4).value = t.nAlunos;
      inV.getCell(4).alignment = { horizontal: "center" };
      inV.getCell(5).value = t.aulas;
      inV.getCell(5).alignment = { horizontal: "center" };
      for (let ci = 2; ci <= 5; ci += 1) inV.getCell(ci).border = thin;
      row += 2;

      // ---- RESULTADOS (fórmulas) ----
      const valH = ws.getRow(row);
      ["Valor fixo", "Variável", "Valor Total"].forEach((v, i) => {
        const c = valH.getCell(i + 2);
        c.value = v;
        c.fill = fill(BLUE);
        c.font = whiteBold;
        c.alignment = { horizontal: "center" };
        c.border = thin;
      });
      row += 1;
      const valRow = row;
      const valV = ws.getRow(row);
      // Valor fixo  = Hora aula × Aulas do mês
      valV.getCell(2).value = formula(`B${inRow}*E${inRow}`, t.valorFixo);
      // Variável    = Variável/aluno × Nº alunos
      valV.getCell(3).value = formula(`C${inRow}*D${inRow}`, t.valorVariavel);
      // Valor total = Valor fixo + Variável
      valV.getCell(4).value = formula(`B${valRow}+C${valRow}`, t.total);
      [2, 3, 4].forEach((ci) => {
        valV.getCell(ci).numFmt = MONEY;
        valV.getCell(ci).border = thin;
      });
      valV.getCell(4).fill = fill(GREEN);
      valV.getCell(4).font = { bold: true, color: { argb: GREENTX } };
      turmaTotalRefs.push(`D${valRow}`);
      row += 2;
    }

    // TOTAL PROFESSOR = soma dos totais das turmas
    const tpRow = row;
    const tp = ws.getRow(row);
    ws.mergeCells(`B${row}:C${row}`);
    tp.getCell(2).value = "TOTAL PROFESSOR";
    tp.getCell(4).value =
      turmaTotalRefs.length > 0
        ? formula(`SUM(${turmaTotalRefs.join(",")})`, p.total)
        : p.total;
    tp.getCell(4).numFmt = MONEY;
    for (const ci of [2, 3, 4]) {
      tp.getCell(ci).fill = fill(BLACK);
      tp.getCell(ci).font = whiteBold;
      tp.getCell(ci).border = thin;
    }
    tp.getCell(4).alignment = { horizontal: "right" };

    meta.push({
      professor: p.professor,
      turmas: p.turmas.length,
      total: p.total,
      totalRef: sheetRef(sheetName, `D${tpRow}`),
    });
  }

  // ============ RESUMO (referencia cada aba) ============
  rs.columns = [{ width: 4 }, { width: 30 }, { width: 12 }, { width: 18 }];
  rs.mergeCells("B2:D2");
  const title = rs.getCell("B2");
  title.value = `FINANCEIRO — ${data.monthLabel.toUpperCase()}`;
  title.font = { bold: true, size: 16, color: { argb: BLACK } };
  rs.mergeCells("B3:D3");
  rs.getCell("B3").value =
    "Pagamento dos professores · fórmulas de cálculo embutidas (edite as entradas e o Excel recalcula).";
  rs.getCell("B3").font = { italic: true, size: 9, color: { argb: "FF808080" } };

  const head = rs.getRow(5);
  ["", "PROFESSOR", "TURMAS", "TOTAL A PAGAR"].forEach((v, i) => {
    const cell = head.getCell(i + 1);
    cell.value = v;
    if (i > 0) {
      cell.fill = fill(BLACK);
      cell.font = whiteBold;
      cell.alignment = { horizontal: i === 1 ? "left" : "right" };
      cell.border = thin;
    }
  });

  const firstDataRow = 6;
  let r = firstDataRow;
  for (const m of meta) {
    const row = rs.getRow(r);
    row.getCell(2).value = m.professor;
    row.getCell(3).value = m.turmas;
    row.getCell(3).alignment = { horizontal: "right" };
    const t = row.getCell(4);
    // TOTAL A PAGAR = referência ao TOTAL PROFESSOR da aba do professor
    t.value = formula(m.totalRef, m.total);
    t.numFmt = MONEY;
    for (let c = 2; c <= 4; c += 1) {
      row.getCell(c).border = thin;
      if (r % 2 === 0) row.getCell(c).fill = fill(ZEBRA);
    }
    r += 1;
  }

  const totalRow = rs.getRow(r);
  totalRow.getCell(2).value = "TOTAL GERAL";
  rs.mergeCells(`B${r}:C${r}`);
  const gt = totalRow.getCell(4);
  gt.value =
    meta.length > 0
      ? formula(`SUM(D${firstDataRow}:D${r - 1})`, data.grandTotal)
      : data.grandTotal;
  gt.numFmt = MONEY;
  for (let c = 2; c <= 4; c += 1) {
    totalRow.getCell(c).fill = fill(BLACK);
    totalRow.getCell(c).font = whiteBold;
    totalRow.getCell(c).border = thin;
  }
  totalRow.getCell(4).alignment = { horizontal: "right" };

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
