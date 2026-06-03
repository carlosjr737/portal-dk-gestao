export function TeacherDnaEvolution({
  rows,
}: {
  rows: Array<{ label: string; score: number | null }>;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">
        Evolução no tempo
      </h2>
      {rows.length > 0 ? (
        <div className="mt-4 flex items-end gap-3 overflow-x-auto pb-1">
          {rows.map((row) => (
            <div key={row.label} className="flex min-w-16 flex-col items-center gap-2">
              <div className="flex h-32 w-9 items-end rounded-full bg-muted">
                <div
                  className="w-full rounded-full bg-primary"
                  style={{ height: `${Math.max(row.score ?? 0, 4)}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-foreground">
                {row.score ?? "-"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formatMonthLabel(row.label)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Sem evolução disponível para o período.
        </p>
      )}
    </section>
  );
}

function formatMonthLabel(label: string) {
  const [year, month] = label.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  }).format(date);
}
