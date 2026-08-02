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
import { getKpisPlataforma } from "@/features/plataforma/kpis-queries";

export const dynamic = "force-dynamic";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** Valor lido, ou um travessão — nunca R$ 0 para "não consegui ler". */
function valor(v: number | null) {
  return v === null ? "—" : dinheiro.format(v);
}

export default async function KpisPage() {
  const { escolas, totais, mrrPlataforma } = await getKpisPlataforma();

  return (
    <div>
      <PageHeader
        title="Indicadores das escolas"
        description="O que cada escola cliente está movimentando, e o que a plataforma recebe delas."
        actions={
          <Link
            href="/plataforma"
            className={buttonVariants({ variant: "outline" })}
          >
            Escolas
          </Link>
        }
      />

      {/*
        Dois blocos separados de propósito. O de cima é o SEU negócio; o de
        baixo é o negócio das suas clientes. Misturar os dois num painel só
        faz alguém somar receita da plataforma com faturamento de escola, que
        são dinheiros de donos diferentes.
      */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Sua plataforma</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Indicador
            rotulo="Receita recorrente"
            valor={dinheiro.format(mrrPlataforma)}
            apoio="soma das assinaturas ativas"
          />
          <Indicador
            rotulo="Escolas"
            valor={String(totais.escolas)}
            apoio={`${totais.escolasComPagamento} com pagamentos ativos`}
          />
          <Indicador
            rotulo="Alunos na base"
            valor={new Intl.NumberFormat("pt-BR").format(totais.alunosAtivos)}
            apoio="somando todas as escolas"
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">
          Movimentação das escolas
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Lido do Asaas com a chave de cada escola. O dinheiro não passa pela
          plataforma — só a consulta.
        </p>

        {totais.escolasSemLeitura > 0 ? (
          <Alert tone="info" className="mt-3">
            {totais.escolasSemLeitura === 1
              ? "1 escola não entra nos totais abaixo"
              : `${totais.escolasSemLeitura} escolas não entram nos totais abaixo`}{" "}
            — o motivo aparece na linha de cada uma.
          </Alert>
        ) : null}

        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Indicador
            rotulo="Recebido no mês"
            valor={dinheiro.format(totais.recebidoNoMes)}
            apoio="líquido, já sem a taxa"
          />
          <Indicador
            rotulo="A receber no mês"
            valor={dinheiro.format(totais.aReceberNoMes)}
            apoio="ainda no prazo"
          />
          <Indicador
            rotulo="Vencido em aberto"
            valor={dinheiro.format(totais.vencidoEmAberto)}
            apoio="acumulado, não só deste mês"
            alarme={totais.vencidoEmAberto > 0}
          />
        </div>
      </section>

      <Table containerClassName="mt-6" minWidth="880px">
        <TableHeader>
          <TableRow>
            <TableHead>Escola</TableHead>
            <TableHead className="text-right tabular-nums">Alunos</TableHead>
            <TableHead className="text-right tabular-nums">Matrículas</TableHead>
            <TableHead className="text-right tabular-nums">Recebido no mês</TableHead>
            <TableHead className="text-right tabular-nums">A receber</TableHead>
            <TableHead className="text-right tabular-nums">Vencido</TableHead>
            <TableHead className="text-right tabular-nums">Saldo</TableHead>
            <TableHead>Assinatura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {escolas.length === 0 ? (
            <TableEmpty colSpan={8}>Nenhuma escola cadastrada ainda.</TableEmpty>
          ) : null}
          {escolas.map((e) => (
            <TableRow key={e.escolaId}>
              <TableCell className="font-medium text-foreground">
                {e.nome}
                {e.motivoSemDados ? (
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {e.motivoSemDados}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {e.alunosAtivos}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {e.matriculasAtivas}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {valor(e.recebidoNoMes)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {valor(e.aReceberNoMes)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {e.vencidoEmAberto ? (
                  <span className="text-danger-text">
                    {valor(e.vencidoEmAberto)}
                  </span>
                ) : (
                  valor(e.vencidoEmAberto)
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {valor(e.saldo)}
              </TableCell>
              <TableCell>
                {e.assinaturaStatus === "ativa" ? (
                  <Badge tone="success">Ativa</Badge>
                ) : e.assinaturaStatus ? (
                  <Badge tone="warning">{e.assinaturaStatus}</Badge>
                ) : (
                  <Badge tone="neutral">Sem assinatura</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p
        className={`mt-2 text-[28px] font-bold leading-[34px] tabular-nums ${
          alarme ? "text-danger-text" : "text-foreground"
        }`}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{apoio}</p>
    </Card>
  );
}
