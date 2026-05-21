import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  confirmContaAzulGuardianLinkAction,
  confirmSafeContaAzulGuardianLinksAction,
} from "@/features/finance/conta-azul/guardian-link-actions";
import {
  getContaAzulGuardianLinkData,
  type ContaAzulGuardianLinkRow,
} from "@/features/finance/conta-azul/guardian-links";

export const dynamic = "force-dynamic";

export default async function VinculosContaAzulPage() {
  const data = await getContaAzulGuardianLinkData();

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Vínculos Conta Azul"
          description="Concilie responsáveis financeiros do Portal DK com clientes da Conta Azul."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financeiro/inadimplencia"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Inadimplência
          </Link>
          <form action={confirmSafeContaAzulGuardianLinksAction}>
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Vincular todos encontrados por CPF
            </button>
          </form>
        </div>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Clientes Conta Azul"
          value={String(data.metrics.totalCustomers)}
        />
        <MetricCard
          label="Clientes com CPF/CNPJ"
          value={String(data.metrics.customersWithDocument)}
        />
        <MetricCard
          label="Responsáveis com CPF/CNPJ"
          value={String(data.metrics.guardiansWithDocument)}
        />
        <MetricCard
          label="Vínculos por CPF"
          value={String(data.metrics.matchedByDocument)}
        />
        <MetricCard
          label="Clientes sem vínculo"
          value={String(data.metrics.customersWithoutLink)}
        />
        <MetricCard
          label="Responsáveis sem vínculo"
          value={String(data.metrics.guardiansWithoutLink)}
        />
      </section>

      <div className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Cliente Conta Azul</th>
                <th className="px-4 py-3 font-semibold">CPF/CNPJ Conta Azul</th>
                <th className="px-4 py-3 font-semibold">
                  Responsável Portal DK encontrado
                </th>
                <th className="px-4 py-3 font-semibold">CPF/CNPJ Portal DK</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.length > 0 ? (
                data.rows.map((row) => (
                  <tr key={row.customer.externalId} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {row.customer.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.customer.externalId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.customer.document || "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.matchedGuardian?.fullName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.matchedGuardian?.document ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "matched_by_document" && row.matchedGuardian ? (
                        <form action={confirmContaAzulGuardianLinkAction}>
                          <input
                            type="hidden"
                            name="guardianId"
                            value={row.matchedGuardian.id}
                          />
                          <input
                            type="hidden"
                            name="contaAzulPersonId"
                            value={row.customer.externalId}
                          />
                          <button
                            type="submit"
                            className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                          >
                            Confirmar vínculo
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum cliente Conta Azul encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ row }: { row: ContaAzulGuardianLinkRow }) {
  const labels: Record<ContaAzulGuardianLinkRow["status"], string> = {
    linked: "Vinculado",
    matched_by_document: "Encontrado por CPF",
    missing_customer_document: "Sem CPF/CNPJ no Conta Azul",
    document_not_found: "CPF/CNPJ não encontrado no Portal DK",
    ambiguous: "Ambíguo",
  };
  const tone =
    row.status === "linked"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : row.status === "matched_by_document"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : row.status === "ambiguous"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-border bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      {labels[row.status]}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
