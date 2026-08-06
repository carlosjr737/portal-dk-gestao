import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMetricasProfessores } from "@/features/teacher-metrics/queries";

export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const brlExato = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export default async function MetricasProfessoresPage() {
  const m = await getMetricasProfessores();

  const custoSobreReceita =
    m.totais.receita > 0 ? (m.totais.custo / m.totais.receita) * 100 : null;

  return (
    <div>
      <PageHeader
        title="Métricas dos professores"
        description={`Receita e custo de ${m.competenciaLabel}, o último mês fechado.`}
      />

      {m.custoIndisponivel ? (
        <Alert tone="danger" className="mt-6">
          {m.custoIndisponivel} Enquanto isso, receita, alunos e horas estão
          corretos — o <strong className="font-medium">custo aparece zerado</strong>,
          e a margem junto.
        </Alert>
      ) : null}

      {m.turmasSemProfessor > 0 ? (
        <Alert tone="warning" className="mt-6">
          {m.turmasSemProfessor}{" "}
          {m.turmasSemProfessor === 1 ? "turma ativa não tem" : "turmas ativas não têm"}{" "}
          professor ({brlExato.format(m.receitaSemProfessor)} de mensalidade).
          Elas ficam fora desta conta — diluir na média inventaria margem que
          não existe.
        </Alert>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Receita das turmas"
          valor={brl.format(m.totais.receita)}
          apoio={`${m.totais.turmas} turmas · ${m.totais.alunos} alunos`}
        />
        <Indicador
          rotulo="Custo com professores"
          valor={brl.format(m.totais.custo)}
          apoio={
            custoSobreReceita === null
              ? "sem receita para comparar"
              : `${custoSobreReceita.toFixed(0)}% da receita`
          }
        />
        <Indicador
          rotulo="Margem"
          valor={brl.format(m.totais.margem)}
          apoio="antes de sala, estrutura e impostos"
        />
        <Indicador
          rotulo="Horas dadas no mês"
          valor={num.format(m.totais.horas)}
          apoio={
            m.totais.horas > 0
              ? `${brlExato.format(m.totais.custo / m.totais.horas)} por hora`
              : "sem horário cadastrado"
          }
        />
      </section>

      {/*
        "Margem" aqui é receita menos o professor, e nada mais. Não é lucro:
        falta sala, estrutura, impostos e a secretaria. Dizer isso no card e
        de novo aqui evita que o número vire meta.
      */}
      <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
        A receita é a mensalidade das matrículas ativas nas turmas de cada
        professor — a turma existiria com outro professor, então o número serve
        para achar turma que não se paga, não para comparar pessoas. As horas
        vêm da duração real de cada aula no calendário do mês.
      </p>

      <Table containerClassName="mt-6" minWidth="1040px">
        <TableHeader>
          <TableRow>
            <TableHead>Professor</TableHead>
            <TableHead className="text-right tabular-nums">Turmas</TableHead>
            <TableHead className="text-right tabular-nums">Alunos</TableHead>
            <TableHead className="text-right tabular-nums">Horas</TableHead>
            <TableHead className="text-right tabular-nums">Receita</TableHead>
            <TableHead className="text-right tabular-nums">Custo</TableHead>
            <TableHead className="text-right tabular-nums">Margem</TableHead>
            <TableHead className="text-right tabular-nums">R$/hora</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {m.professores.length === 0 ? (
            <TableEmpty colSpan={8}>
              Nenhuma turma ativa com professor.
            </TableEmpty>
          ) : null}
          {m.professores.map((p) => (
            <TableRow key={p.professor}>
              <TableCell className="font-medium text-foreground">
                {p.professor}
                {p.temPendencia ? (
                  <Badge tone="warning" className="ml-2">
                    sem modelo
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {p.turmas}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {p.alunos}
                <span className="block text-xs text-muted-foreground">
                  {p.alunosPorTurma.toFixed(1).replace(".", ",")}/turma
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {num.format(p.horas)}
                <span className="block text-xs">{p.aulas} aulas</span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground">
                {brl.format(p.receita)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {brl.format(p.custo)}
                {p.custoSobreReceita !== null ? (
                  <span className="block text-xs text-muted-foreground">
                    {p.custoSobreReceita.toFixed(0)}% da receita
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span
                  className={
                    p.margem < 0
                      ? "font-medium text-danger-text"
                      : "font-medium text-foreground"
                  }
                >
                  {brl.format(p.margem)}
                </span>
              </TableCell>
              {/*
                As duas taxas juntas na mesma célula: sozinho, "custo por hora"
                convida a comparar professores por preço, e é a distância entre
                as duas que diz se a hora se paga.
              */}
              <TableCell className="text-right tabular-nums">
                <span className="text-foreground">
                  {p.receitaPorHora === null
                    ? "—"
                    : brlExato.format(p.receitaPorHora)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  custa{" "}
                  {p.custoPorHora === null
                    ? "—"
                    : brlExato.format(p.custoPorHora)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/*
        O detalhe por turma é o que torna o total acionável: professor com
        margem baixa costuma ter UMA turma vazia entre turmas cheias, e o
        agregado esconde exatamente isso.
      */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Por turma</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Onde a receita se concentra. Turma com poucos alunos e a mesma
          duração é a que puxa a média para baixo.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {m.professores.map((p) => (
            <Card key={p.professor} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {p.professor}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {p.turmas} {p.turmas === 1 ? "turma" : "turmas"} ·{" "}
                  {num.format(p.horas)}h
                </span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {p.detalhe.map((t) => (
                  <li
                    key={t.turma}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {t.turma}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {t.alunos} {t.alunos === 1 ? "aluno" : "alunos"}
                    </span>
                    <span className="w-24 shrink-0 text-right tabular-nums text-foreground">
                      {brl.format(t.receita)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  apoio,
}: {
  rotulo: string;
  valor: string;
  apoio: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{apoio}</p>
    </Card>
  );
}
