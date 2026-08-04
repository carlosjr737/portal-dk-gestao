import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { getInadimplenciaDoMes } from "@/features/inadimplencia/queries";

export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const inteiro = new Intl.NumberFormat("pt-BR");

function dataBR(iso: string) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

export default async function InadimplenciaPage() {
  const i = await getInadimplenciaDoMes();

  const mes = new Date(`${i.competencia}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const noAsaas = i.devedores.filter((d) => d.origem === "asaas");
  const semBaixa = i.devedores.filter((d) => d.origem === "sem_baixa");

  return (
    <div>
      <PageHeader
        title="Inadimplência"
        description={`Mensalidades vencidas de ${mes}.`}
      />

      {i.modeloPendente ? (
        <Alert tone="warning" className="mt-6">
          O modelo de recebimento ainda não existe no banco. Só a inadimplência
          do Asaas aparece até rodar{" "}
          <code className="font-mono text-xs">
            scripts/recebimento_01_modelo.sql
          </code>
          .
        </Alert>
      ) : null}

      {/*
        Matrícula sem data de vencimento não entra na conta — e isso não é
        política, é aritmética: sem data não existe "passou do prazo". São
        poucas e aparecem com esse nome, para não serem confundidas com quem
        está em dia.
      */}
      {i.semVencimento > 0 ? (
        <Alert tone="warning" className="mt-6">
          <strong className="font-medium">
            {inteiro.format(i.semVencimento)}{" "}
            {i.semVencimento === 1 ? "matrícula está" : "matrículas estão"} sem
            data de vencimento
          </strong>{" "}
          ({brl.format(i.valorSemVencimento)}). Sem a data não dá para dizer se
          atrasou — elas ficam fora desta lista até alguém preencher.
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Em atraso"
          valor={brl.format(i.valorEmAtraso)}
          detalhe={`${i.devedores.length} ${i.devedores.length === 1 ? "matrícula" : "matrículas"}`}
          alarme={i.devedores.length > 0}
        />
        <Indicador
          rotulo="Atrasado no Asaas"
          valor={String(noAsaas.length)}
          detalhe="o provedor confirmou o vencimento"
        />
        <Indicador
          rotulo="Sem baixa registrada"
          valor={String(semBaixa.length)}
          detalhe="pode ter pago sem alguém marcar"
        />
        <Indicador
          rotulo="A vencer"
          valor={brl.format(i.valorAVencer)}
          detalhe={`${i.aVencer} ainda no prazo · ${i.pagas} ${i.pagas === 1 ? "paga" : "pagas"}`}
        />
      </div>

      <Table containerClassName="mt-6" minWidth="900px">
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Turma</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right tabular-nums">Atraso</TableHead>
            <TableHead>Venceu em</TableHead>
            <TableHead className="text-right tabular-nums">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {i.devedores.length === 0 ? (
            <TableEmpty colSpan={7}>
              {i.aVencer > 0
                ? "Ninguém em atraso — as mensalidades deste mês ainda não venceram."
                : "Ninguém em atraso neste mês."}
            </TableEmpty>
          ) : null}
          {i.devedores.map((d) => (
            <TableRow key={d.enrollmentId}>
              <TableCell className="font-medium text-foreground">
                {d.aluno}
              </TableCell>
              <TableCell className="text-muted-foreground">{d.turma}</TableCell>
              <TableCell>
                <p className="text-foreground">{d.responsavel}</p>
                {d.telefone ? (
                  <p className="text-xs text-muted-foreground">{d.telefone}</p>
                ) : null}
              </TableCell>
              <TableCell>
                {/*
                  A origem diz o que fazer. "Atrasado no Asaas" é cobrança que
                  venceu sem pagar. "Sem baixa" pode ser gente que pagou e
                  ninguém marcou — cobrar essa pessoa é o erro caro.
                */}
                {d.origem === "asaas" ? (
                  <Badge tone="danger">Atrasado no Asaas</Badge>
                ) : (
                  <Badge tone="warning">Sem baixa</Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span
                  className={
                    d.diasDeAtraso >= 30
                      ? "font-medium text-danger-text"
                      : d.diasDeAtraso >= 15
                        ? "font-medium text-warning-text"
                        : "text-muted-foreground"
                  }
                >
                  {d.diasDeAtraso} {d.diasDeAtraso === 1 ? "dia" : "dias"}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {dataBR(d.vencimento)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground">
                {brl.format(d.valor)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {semBaixa.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/financeiro/recebimentos"
            className={buttonVariants({ variant: "outline" })}
          >
            Ir para a conciliação
          </Link>
          <p className="text-sm text-muted-foreground">
            {inteiro.format(semBaixa.length)} destas some da lista assim que a
            baixa for marcada.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  alarme,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  alarme?: boolean;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p
        className={`mt-2 text-2xl font-bold tabular-nums ${alarme ? "text-danger-text" : "text-foreground"}`}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
    </Card>
  );
}
