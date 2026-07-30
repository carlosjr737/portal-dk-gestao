import { PageHeader } from "@/components/layout/page-header";
import { getTeacherPaymentData } from "@/features/teacher-payments/queries";

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

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-md border border-border bg-white p-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Mês</span>
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="mt-1 h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Ver
        </button>
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
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-semibold">Professor</th>
              <th className="px-5 py-3 text-right font-semibold">Turmas</th>
              <th className="px-5 py-3 text-right font-semibold">Total a pagar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.professores.map((p) => (
              <tr key={p.professor} className="hover:bg-muted/50">
                <td className="px-5 py-3 font-medium text-foreground">{p.professor}</td>
                <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                  {p.turmas.length}
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-foreground">
                  {brl(p.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-semibold">
              <td className="px-5 py-3" colSpan={2}>
                Total geral
              </td>
              <td className="px-5 py-3 text-right tabular-nums">{brl(data.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}
