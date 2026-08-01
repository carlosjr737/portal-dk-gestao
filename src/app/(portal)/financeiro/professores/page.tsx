import { PageHeader } from "@/components/layout/page-header";
import { getTeacherPaymentData } from "@/features/teacher-payments/queries";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FinanceiroProfessoresPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const param = (await searchParams)?.month;
  const month = /^\d{4}-\d{2}$/.test(param ?? "") ? (param as string) : currentMonth();
  const [year, mon] = month.split("-").map(Number);
  const data = await getTeacherPaymentData(year, mon);

  return (
    <div>
      <PageHeader
        title="Financeiro dos professores"
        description="Pagamento por professor (hora-aula × aulas + variável × alunos), com base no rate card e nas matrículas ativas."
      />

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Mês</span>
          <Input
            type="month"
            name="month"
            defaultValue={month}
            className="mt-1"
          />
        </label>
        <Button type="submit">Ver</Button>
        <a
          href={`/api/financeiro/professores?month=${month}`}
          className="h-10 inline-flex items-center rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90"
        >
          ⬇ Baixar xlsx ({data.monthLabel})
        </a>
      </form>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Resumo — {data.monthLabel}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Aulas = ocorrências do dia da turma no mês (paga cheio, sem descontar recesso).
          </p>
        </div>
        {/* px-5 nas células para acompanhar o padding do cabeçalho da seção. */}
        <Table
          containerClassName="rounded-none border-0"
          className="[&_td]:px-5 [&_th]:px-5"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Professor</TableHead>
              <TableHead className="text-right">Turmas</TableHead>
              <TableHead className="text-right">Total a pagar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.professores.length > 0 ? (
              data.professores.map((p) => (
                <TableRow key={p.professor}>
                  <TableCell className="font-medium text-foreground">
                    {p.professor}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.turmas.length}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {brl(p.total)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty colSpan={3}>Nenhum professor encontrado.</TableEmpty>
            )}
          </TableBody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-semibold">
              <TableCell colSpan={2}>Total geral</TableCell>
              <TableCell className="text-right tabular-nums">
                {brl(data.grandTotal)}
              </TableCell>
            </tr>
          </tfoot>
        </Table>
      </section>
    </div>
  );
}
