import "server-only";

import ExcelJS from "exceljs";
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

function safeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/*?:[\]]/g, "").slice(0, 28) || "Prof";
  let n = base;
  let i = 2;
  while (used.has(n)) n = `${base} ${i++}`.slice(0, 31);
  used.add(n);
  return n;
}

export async function buildTeacherPaymentsWorkbook(
  data: TeacherPaymentData,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Portal DK Gestão";

  // ============ RESUMO ============
  const rs = wb.addWorksheet("RESUMO", {
    views: [{ showGridLines: false }],
  });
  rs.columns = [{ width: 4 }, { width: 30 }, { width: 12 }, { width: 18 }];
  rs.mergeCells("B2:D2");
  const title = rs.getCell("B2");
  title.value = `FINANCEIRO DK — ${data.monthLabel.toUpperCase()}`;
  title.font = { bold: true, size: 16, color: { argb: BLACK } };
  rs.mergeCells("B3:D3");
  rs.getCell("B3").value =
    "Pagamento dos professores · gerado pelo portal (aulas contadas no mês, sem descontar recesso).";
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
  let r = 6;
  for (const p of data.professores) {
    const row = rs.getRow(r);
    row.getCell(2).value = p.professor;
    row.getCell(3).value = p.turmas.length;
    row.getCell(3).alignment = { horizontal: "right" };
    const t = row.getCell(4);
    t.value = p.total;
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
  gt.value = data.grandTotal;
  gt.numFmt = MONEY;
  for (let c = 2; c <= 4; c += 1) {
    totalRow.getCell(c).fill = fill(BLACK);
    totalRow.getCell(c).font = whiteBold;
    totalRow.getCell(c).border = thin;
  }
  totalRow.getCell(4).alignment = { horizontal: "right" };

  // ============ uma aba por professor ============
  const used = new Set<string>(["RESUMO"]);
  for (const p of data.professores) {
    const ws = wb.addWorksheet(safeSheetName(p.professor, used), {
      views: [{ showGridLines: false }],
    });
    ws.columns = [
      { width: 5 }, { width: 16 }, { width: 14 }, { width: 13 },
      { width: 11 }, { width: 8 }, { width: 16 },
    ];
    let row = 1;

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

      // barra azul do cálculo
      const calcH = ws.getRow(row);
      ["Hora aula", "Variável", "Nº Alunos"].forEach((v, i) => {
        const c = calcH.getCell(i + 2);
        c.value = v;
        c.fill = fill(BLUE);
        c.font = whiteBold;
        c.alignment = { horizontal: "center" };
        c.border = thin;
      });
      row += 1;
      const calcV = ws.getRow(row);
      calcV.getCell(2).value = t.horaAula;
      calcV.getCell(2).numFmt = MONEY;
      calcV.getCell(3).value = t.valorAluno;
      calcV.getCell(3).numFmt = MONEY;
      calcV.getCell(4).value = t.nAlunos;
      calcV.getCell(4).alignment = { horizontal: "center" };
      for (let ci = 2; ci <= 4; ci += 1) calcV.getCell(ci).border = thin;
      row += 1;
      ws.mergeCells(`B${row}:D${row}`);
      const am = ws.getRow(row);
      am.getCell(2).value = `Aulas mensais: ${t.aulas}`;
      am.getCell(2).font = { bold: true };
      am.getCell(2).alignment = { horizontal: "center" };
      for (let ci = 2; ci <= 4; ci += 1) am.getCell(ci).border = thin;
      row += 1;
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
      const valV = ws.getRow(row);
      valV.getCell(2).value = t.valorFixo;
      valV.getCell(3).value = t.valorVariavel;
      valV.getCell(4).value = t.total;
      [2, 3, 4].forEach((ci) => {
        valV.getCell(ci).numFmt = MONEY;
        valV.getCell(ci).border = thin;
      });
      valV.getCell(4).fill = fill(GREEN);
      valV.getCell(4).font = { bold: true, color: { argb: GREENTX } };
      row += 2;
    }

    const tp = ws.getRow(row);
    ws.mergeCells(`B${row}:C${row}`);
    tp.getCell(2).value = "TOTAL PROFESSOR";
    tp.getCell(4).value = p.total;
    tp.getCell(4).numFmt = MONEY;
    for (const ci of [2, 3, 4]) {
      tp.getCell(ci).fill = fill(BLACK);
      tp.getCell(ci).font = whiteBold;
      tp.getCell(ci).border = thin;
    }
    tp.getCell(4).alignment = { horizontal: "right" };
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
