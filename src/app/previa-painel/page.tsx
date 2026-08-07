// TEMPORÁRIO — gera o screenshot de public/screens/painel.png. Não vai para o repositório.
// Nomes fictícios de propósito: a imagem é pública e nome de aluno é dado pessoal.
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const TURMAS = [
  { nome: "Ballet Infantil — Ter/Qui 16:00", alunos: 18, cap: 20 },
  { nome: "Jazz Juvenil — Seg/Qua 17:30", alunos: 16, cap: 18 },
  { nome: "Danças Urbanas Kids — Ter/Qui 16:00", alunos: 21, cap: 22 },
  { nome: "Contemporâneo Sênior — Seg/Qua 19:00", alunos: 9, cap: 20 },
  { nome: "Ballet Adulto — Sáb 10:00", alunos: 12, cap: 16 },
];

const DEVEDORES = [
  { aluno: "Helena Marques", turma: "Ballet Infantil", dias: 12, valor: 452 },
  { aluno: "Rafael Antunes", turma: "Jazz Juvenil", dias: 7, valor: 384 },
  { aluno: "Beatriz Coelho", turma: "Danças Urbanas Kids", dias: 3, valor: 452 },
];

const MENU = [
  ["Dashboard", false],
  ["Métricas da escola", false],
  ["Alunos", false],
  ["Matrículas", false],
  ["Turmas", false],
  ["Chamada", false],
  ["Financeiro", true],
  ["Inadimplência", false],
  ["Recebimentos", false],
] as const;

export default function PreviaPainel() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Barra lateral: é ela que faz o print parecer o sistema, e não um card solto. */}
      <aside className="w-56 shrink-0 bg-inverse px-3 py-5 text-white/70">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-[13px] font-bold text-white">
            E
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-white">
              Escola Exemplo
            </span>
            <span className="block text-[11px] text-white/55">SouAle</span>
          </span>
        </div>
        <nav className="space-y-0.5">
          {MENU.map(([label, ativo]) => (
            <span
              key={label}
              className={`block rounded-md px-3 py-2 text-sm ${
                ativo ? "bg-primary font-medium text-white" : "text-white/70"
              }`}
            >
              {label}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex-1 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Financeiro
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Faturamento e recebimento de agosto de 2026.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Indicador rotulo="Faturamento contratado" valor={brl.format(58400)} apoio="142 matrículas ativas" />
          <Indicador rotulo="Recebido" valor={brl.format(51120)} apoio="88% do emitido" />
          <Indicador rotulo="Em atraso" valor={brl.format(1288)} apoio="3 matrículas" alarme />
          <Indicador rotulo="A vencer" valor={brl.format(5992)} apoio="ainda no prazo" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">
                Ocupação por turma
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Turma com vaga sobrando é receita parada.
              </p>
            </div>
            <ul className="divide-y divide-border">
              {TURMAS.map((t) => {
                const pct = Math.round((t.alunos / t.cap) * 100);
                const baixa = pct < 60;
                return (
                  <li key={t.nome} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm text-foreground">
                        {t.nome}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {t.alunos}/{t.cap}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={baixa ? "h-full bg-warning" : "h-full bg-success"}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">
                Inadimplência
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Vencido e sem baixa registrada.
              </p>
            </div>
            <Table containerClassName="rounded-none border-0" minWidth="0px">
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead className="text-right tabular-nums">Atraso</TableHead>
                  <TableHead className="text-right tabular-nums">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEVEDORES.map((d) => (
                  <TableRow key={d.aluno}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{d.aluno}</p>
                      <p className="text-xs text-muted-foreground">{d.turma}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge tone={d.dias >= 10 ? "danger" : "warning"}>
                        {d.dias} dias
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {brl.format(d.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  apoio,
  alarme,
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  alarme?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p
        className={`mt-1.5 text-xl font-bold tabular-nums ${alarme ? "text-danger-text" : "text-foreground"}`}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{apoio}</p>
    </Card>
  );
}
