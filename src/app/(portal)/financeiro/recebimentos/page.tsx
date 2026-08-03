import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { competenciaDe } from "@/features/faturamento/queries";
import { getRecebimentosDoMes } from "@/features/recebimentos/queries";
import { RecebimentosLista } from "@/features/recebimentos/recebimentos-lista";
import { MarcarDia } from "@/features/recebimentos/marcar-dia";

export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

type Filtro = "todas" | "pendentes" | "recebidas" | "atraso";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "pendentes", label: "Pendentes" },
  { id: "recebidas", label: "Recebidas" },
  { id: "atraso", label: "Em atraso" },
];

type PageProps = {
  searchParams?: Promise<{ mes?: string; filtro?: string }>;
};

function deslocarMes(competencia: string, meses: number) {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`;
}

function rotularMes(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

/** `YYYY-MM-DD` de hoje no fuso do servidor — o formato do <input type="date">. */
function dataDeHoje() {
  const agora = new Date();
  return [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, "0"),
    String(agora.getDate()).padStart(2, "0"),
  ].join("-");
}

export default async function RecebimentosPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const competencia = /^\d{4}-\d{2}-01$/.test(params?.mes ?? "")
    ? params!.mes!
    : competenciaDe();
  const filtro: Filtro = FILTROS.some((f) => f.id === params?.filtro)
    ? (params!.filtro as Filtro)
    : "todas";

  const dados = await getRecebimentosDoMes(competencia);
  const hoje = dataDeHoje();

  const linhas = dados.linhas.filter((linha) => {
    if (filtro === "recebidas") return linha.paga;
    if (filtro === "pendentes") return !linha.paga;
    if (filtro === "atraso") {
      return (
        !linha.paga &&
        linha.origem !== "nenhuma" &&
        (linha.vencimento === null || linha.vencimento < hoje)
      );
    }
    return true;
  });

  const cobertura =
    dados.matriculasAtivas > 0
      ? Math.round((dados.matriculasCobertas / dados.matriculasAtivas) * 100)
      : 0;
  const percentualRecebido =
    dados.contratadoCoberto > 0
      ? Math.round((dados.recebido / dados.contratadoCoberto) * 100)
      : 0;

  const href = (patch: { mes?: string; filtro?: Filtro }) => {
    const busca = new URLSearchParams();
    busca.set("mes", patch.mes ?? competencia);
    const f = patch.filtro ?? filtro;
    if (f !== "todas") busca.set("filtro", f);
    return `/financeiro/recebimentos?${busca.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Recebimentos"
          description="Acompanhe o que entrou e o que falta entrar."
        />
        <nav className="flex items-center gap-1" aria-label="Competência">
          <Link
            href={href({ mes: deslocarMes(competencia, -1) })}
            className="grid h-9 w-9 place-items-center rounded-lg border border-input text-muted-foreground transition hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="min-w-[148px] text-center text-sm font-semibold text-foreground">
            {rotularMes(competencia)}
          </span>
          <Link
            href={href({ mes: deslocarMes(competencia, 1) })}
            className="grid h-9 w-9 place-items-center rounded-lg border border-input text-muted-foreground transition hover:bg-muted"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </nav>
      </div>

      {dados.modeloPendente ? (
        <Alert tone="warning" className="mt-6">
          O modelo de recebimento ainda não foi aplicado no banco. Rode
          <code className="mx-1">scripts/recebimento_01_modelo.sql</code>
          antes de conciliar — sem ele, marcar não grava nada.
        </Alert>
      ) : null}

      <div className="mt-4">
        <SeloContexto
          contexto={dados.contexto}
          noAsaas={dados.matriculasNoAsaas}
          manuais={dados.marcacoesManuais}
        />
      </div>

      {/* O resumo. A primeira coluna é SEMPRE faturamento contratado — é a
          âncora, e não muda entre contextos. */}
      <Card className="mt-3 p-5">
        <div className="grid gap-5 md:grid-cols-3 md:divide-x md:divide-border">
          <Coluna
            rotulo="Faturamento contratado"
            valor={brl.format(dados.contratado)}
            apoio={`${dados.matriculasAtivas} matrículas ativas`}
          />
          <Coluna
            className="md:pl-5"
            rotulo={
              dados.contexto === "misto"
                ? "Cobrado pelo sistema"
                : dados.contexto === "total"
                  ? "Recebido"
                  : "Conciliado"
            }
            valor={brl.format(
              dados.contexto === "misto" ? dados.contratadoCoberto : dados.recebido,
            )}
            apoio={
              dados.contexto === "misto"
                ? `${dados.matriculasCobertas} de ${dados.matriculasAtivas} matrículas · ${cobertura}%`
                : `${dados.cobrancasRecebidas} de ${dados.matriculasAtivas} cobranças`
            }
            tom="success"
          />
          <Coluna
            className="md:pl-5"
            rotulo={dados.contexto === "misto" ? "Recebido do cobrado" : "Em atraso"}
            valor={brl.format(
              dados.contexto === "misto" ? dados.recebido : dados.valorEmAtraso,
            )}
            apoio={
              dados.contexto === "misto"
                ? `${percentualRecebido}% do cobrado`
                : `${dados.emAtraso} cobranças`
            }
            tom={dados.contexto === "misto" ? "success" : "danger"}
          />
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success"
            style={{
              width: `${Math.min(100, dados.contratado > 0 ? (dados.recebido / dados.contratado) * 100 : 0)}%`,
            }}
          />
        </div>
      </Card>

      {/*
        A linha de cobertura é obrigatória em toda tela que mostra recebimento.
        Sem ela, R$ 904 lidos contra R$ 271 mil parecem 99% de calote.
        Tom neutro de propósito: não é problema, é definição.
      */}
      {dados.matriculasCobertas < dados.matriculasAtivas ? (
        <Alert tone="info" className="mt-3">
          <span>
            <strong className="font-semibold">
              Recebido é comparado com o cobrado, não com o faturamento.
            </strong>{" "}
            {dados.matriculasAtivas - dados.matriculasCobertas} matrículas ainda
            não são cobradas pelo sistema — elas contam no faturamento e ficam
            fora deste bloco.
          </span>
        </Alert>
      ) : null}

      {dados.semVencimento > 0 ? (
        <Alert tone="warning" className="mt-3">
          <span>
            {dados.semVencimento} de {dados.matriculasAtivas} matrículas não têm
            dia de vencimento cadastrado. Elas aparecem sem data e não entram na
            marcação por dia.
          </span>
        </Alert>
      ) : null}

      <Card className="mt-3 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((opcao) => (
              <Link
                key={opcao.id}
                href={href({ filtro: opcao.id })}
                aria-current={filtro === opcao.id ? "page" : undefined}
                className={
                  filtro === opcao.id
                    ? "rounded-lg bg-foreground px-3 py-1.5 text-[13px] font-semibold text-card"
                    : "rounded-lg border border-input px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted"
                }
              >
                {opcao.label}
              </Link>
            ))}
          </div>

          {dados.contexto !== "total" && dados.diasComPendencia.length > 0 ? (
            <MarcarDia
              competencia={competencia}
              dias={dados.diasComPendencia}
              hoje={hoje}
            />
          ) : null}
        </div>

        <RecebimentosLista
          linhas={linhas}
          competencia={competencia}
          hoje={hoje}
        />

        <Rodape
          contexto={dados.contexto}
          marcacoesManuais={dados.marcacoesManuais}
        />
      </Card>
    </div>
  );
}

function Coluna({
  rotulo,
  valor,
  apoio,
  tom,
  className,
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  tom?: "success" | "danger";
  className?: string;
}) {
  const cor =
    tom === "success"
      ? "text-success-text"
      : tom === "danger"
        ? "text-danger-text"
        : "text-foreground";

  return (
    <div className={className}>
      <p className="text-[12.5px] font-medium text-muted-foreground">{rotulo}</p>
      <p
        className={`mt-2 text-[28px] font-bold leading-none tracking-tight tabular-nums ${cor}`}
      >
        {valor}
      </p>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{apoio}</p>
    </div>
  );
}

function SeloContexto({
  contexto,
  noAsaas,
  manuais,
}: {
  contexto: "sem_cobranca" | "misto" | "total";
  noAsaas: number;
  manuais: number;
}) {
  if (contexto === "total") {
    return <Badge tone="success">Automático · baixa pelo Asaas</Badge>;
  }
  if (contexto === "misto") {
    return (
      <Badge tone="warning">
        Misto · {noAsaas} automáticas, {manuais} à mão
      </Badge>
    );
  }
  return <Badge tone="info">Conciliação manual · você marca o que entrou</Badge>;
}

/**
 * O empurrão para o Asaas: uma vez, no fim, depois de a pessoa ter feito o
 * trabalho — e só com número que o sistema consegue provar. Sem banner no
 * topo, sem modal, e sem estimativa de horas economizadas.
 */
function Rodape({
  contexto,
  marcacoesManuais,
}: {
  contexto: "sem_cobranca" | "misto" | "total";
  marcacoesManuais: number;
}) {
  if (contexto === "total") {
    return (
      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Todas as cobranças são atualizadas automaticamente. Nada a conciliar à
        mão.
      </p>
    );
  }

  if (contexto === "misto") {
    return (
      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Linhas com cadeado são atualizadas pelo Asaas e não podem ser marcadas à
        mão.
      </p>
    );
  }

  if (marcacoesManuais === 0) return null;

  return (
    <div className="border-t border-border px-5 py-4">
      <p className="text-xs text-muted-foreground">
        Você marcou {marcacoesManuais} cobranças manualmente este mês. Com
        cobrança pelo sistema, a baixa acontece sozinha e o atraso aparece no
        mesmo dia.
      </p>
      <Link
        href="/configuracoes/escola"
        className="mt-2 inline-flex text-[13px] font-semibold text-primary hover:underline"
      >
        Ativar cobrança pelo sistema →
      </Link>
    </div>
  );
}
