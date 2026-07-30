import "server-only";

import ExcelJS from "exceljs";
import type { TeacherPaymentData } from "@/features/teacher-payments/queries";

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const bold = { bold: true } as const;

  // ---- RESUMO ----
  const rs = wb.addWorksheet("RESUMO");
  rs.getColumn(1).width = 22;
  rs.getColumn(2).width = 18;
  rs.getCell("A1").value = `FINANCEIRO DK — ${data.monthLabel} (gerado pelo portal)`;
  rs.getCell("A1").font = { bold: true, size: 13 };
  rs.getCell("A2").value =
    "Aulas = ocorrências do dia da turma no mês (paga cheio, sem descontar recesso).";
  rs.getCell("A4").value = "PROFESSOR";
  rs.getCell("B4").value = "TOTAL A PAGAR";
  rs.getRow(4).font = bold;
  let r = 5;
  for (const p of data.professores) {
    rs.getCell(`A${r}`).value = p.professor;
    rs.getCell(`B${r}`).value = brl(p.total);
    r += 1;
  }
  rs.getCell(`A${r + 1}`).value = "TOTAL GERAL";
  rs.getCell(`B${r + 1}`).value = brl(data.grandTotal);
  rs.getRow(r + 1).font = bold;

  // ---- uma aba por professor ----
  const used = new Set<string>(["RESUMO"]);
  for (const p of data.professores) {
    const ws = wb.addWorksheet(safeSheetName(p.professor, used));
    ws.getColumn(1).width = 10;
    ws.getColumn(2).width = 36;
    ws.getColumn(3).width = 16;
    let row = 1;
    for (const t of p.turmas) {
      ["PROFESSOR", "TURMA", "NÍVEL", "HORÁRIO"].forEach((v, i) => {
        const cell = ws.getCell(row, i + 1);
        cell.value = v;
        cell.font = bold;
      });
      row += 1;
      [p.professor, t.diasLabel, t.nivel, t.horario].forEach((v, i) => {
        ws.getCell(row, i + 1).value = v;
      });
      row += 2;
      ws.getCell(row, 1).value = "NOME";
      ws.getCell(row, 1).font = bold;
      ws.getCell(row, 3).value = "CONDIÇÃO";
      ws.getCell(row, 3).font = bold;
      row += 1;
      t.alunos.forEach((a, i) => {
        ws.getCell(row, 1).value = i + 1;
        ws.getCell(row, 2).value = a.nome;
        ws.getCell(row, 3).value = a.condicao;
        row += 1;
      });
      row += 1;
      ["Hora aula", "Variável", "Nº Alunos"].forEach((v, i) => {
        ws.getCell(row, i + 1).value = v;
        ws.getCell(row, i + 1).font = bold;
      });
      row += 1;
      ws.getCell(row, 1).value = brl(t.horaAula);
      ws.getCell(row, 2).value = brl(t.valorAluno);
      ws.getCell(row, 3).value = t.nAlunos;
      row += 1;
      ws.getCell(row, 1).value = `Aulas mensais: ${t.aulas}`;
      ws.getCell(row, 1).font = bold;
      row += 1;
      ["Valor", "Valor", "Valor Total"].forEach((v, i) => {
        ws.getCell(row, i + 1).value = v;
        ws.getCell(row, i + 1).font = bold;
      });
      row += 1;
      ws.getCell(row, 1).value = brl(t.valorFixo);
      ws.getCell(row, 2).value = brl(t.valorVariavel);
      ws.getCell(row, 3).value = brl(t.total);
      ws.getCell(row, 3).font = bold;
      row += 3;
    }
    ws.getCell(row, 1).value = "TOTAL PROFESSOR";
    ws.getCell(row, 1).font = bold;
    ws.getCell(row, 3).value = brl(p.total);
    ws.getCell(row, 3).font = bold;
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
