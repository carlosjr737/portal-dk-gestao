import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  LineChart,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AsaasSelo } from "@/components/brand/asaas-selo";
import { buttonVariants } from "@/components/ui/button";
import {
  PLATFORM_NAME,
  PLATFORM_TAGLINE,
  PLATFORM_URL,
} from "@/lib/branding";

/**
 * Site público.
 *
 * A raiz redirecionava para `/dashboard`, então quem chegava sem login batia
 * na tela de entrar sem nunca saber o que o produto faz. Agora `/` é a página
 * pública e o portal continua em `/dashboard`.
 *
 * ESTÁTICA DE PROPÓSITO. O resto do sistema é `force-dynamic` porque toda
 * tela depende de sessão e banco; esta não depende de nada, e renderizar no
 * build é o que faz ela abrir rápido para quem chegou de busca ou anúncio.
 *
 * NENHUM NÚMERO AQUI É ENFEITE. Os dados de operação são de uma escola real
 * usando o sistema hoje. Depoimento inventado e logo de cliente que não
 * existe são o caminho mais curto para perder a conversa na primeira reunião
 * — e, num produto que oferece serviço financeiro, para queimar a análise do
 * provedor.
 */

export const metadata: Metadata = {
  title: `${PLATFORM_NAME} — ${PLATFORM_TAGLINE}`,
  description:
    "Matrícula, turmas, chamada e cobrança das mensalidades num sistema só. Feito para escolas de dança e artes.",
  metadataBase: new URL(PLATFORM_URL),
  alternates: { canonical: "/" },
  openGraph: {
    title: `${PLATFORM_NAME} — ${PLATFORM_TAGLINE}`,
    description:
      "Matrícula, turmas, chamada e cobrança das mensalidades num sistema só.",
    url: PLATFORM_URL,
    siteName: PLATFORM_NAME,
    locale: "pt_BR",
    type: "website",
  },
};

const RECURSOS = [
  {
    Icone: Users,
    titulo: "Alunos e responsáveis",
    texto:
      "Cadastro com responsável financeiro, histórico e documentos. Irmãos ficam ligados à mesma família.",
  },
  {
    Icone: ClipboardList,
    titulo: "Matrículas e turmas",
    texto:
      "Valor, desconto e vigência por matrícula. Trocar o aluno de turma não cancela nem gera cobrança nova.",
  },
  {
    Icone: CalendarCheck,
    titulo: "Chamada digital",
    texto:
      "O professor marca presença pelo celular. Quem está faltando demais aparece antes de desistir.",
  },
  {
    Icone: Receipt,
    titulo: "Mensalidades",
    texto:
      "Cobrança recorrente por Pix ou boleto, com baixa automática. Quem cobra por fora concilia na mão, na mesma tela.",
  },
  {
    Icone: LineChart,
    titulo: "Números que decidem",
    texto:
      "Inadimplência, entradas e saídas, ocupação por turma e quanto cada professor custa por hora.",
  },
  {
    Icone: ShieldCheck,
    titulo: "O dinheiro é seu",
    texto:
      "A conta de pagamentos é aberta no CNPJ da escola. O valor cai direto nela — não passa por nós.",
  },
] as const;

export default function SitePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── topo ─────────────────────────────────────────────────────── */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              A
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold text-foreground">
                {PLATFORM_NAME}
              </span>
              {/* Some no celular: quebrava em duas linhas e dobrava a
                  altura do cabeçalho para dizer o que o título já diz. */}
              <span className="hidden text-xs text-muted-foreground sm:block">
                {PLATFORM_TAGLINE}
              </span>
            </span>
          </span>

          <div className="flex items-center gap-2">
            <Link
              href="#planos"
              className="hidden rounded px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Planos
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline" })}>
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* ── hero ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-primary">
            Para escolas de dança, música e teatro
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            A secretaria da sua escola em um lugar só
          </h1>
          {/*
            O texto fala do problema antes da solução. Quem gerencia escola de
            artes não acorda querendo "um sistema" — acorda com a planilha
            desatualizada e o WhatsApp cheio de "já paguei".
          */}
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Matrícula, turmas, chamada e mensalidade deixam de morar em três
            planilhas e num caderno. O sistema sabe quem está matriculado, quem
            faltou e quem pagou — e diz quando alguma dessas três muda.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="#planos"
              className={buttonVariants({ className: "h-12 px-6 text-base" })}
            >
              Ver planos
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className={buttonVariants({
                variant: "outline",
                className: "h-12 px-6 text-base",
              })}
            >
              Já sou cliente
            </Link>
          </div>
        </div>
      </section>

      {/* ── prova ────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-sm text-muted-foreground">
            Em operação real, todo dia, numa escola com:
          </p>
          <dl className="mt-5 grid gap-6 sm:grid-cols-4">
            <Numero valor="665" rotulo="matrículas ativas" />
            <Numero valor="433" rotulo="famílias" />
            <Numero valor="52" rotulo="turmas" />
            <Numero valor="14" rotulo="professores" />
          </dl>
        </div>
      </section>

      {/* ── recursos ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          O que ele faz
        </h2>
        <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r) => (
            <div key={r.titulo}>
              <r.Icone className="h-6 w-6 text-primary" aria-hidden />
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {r.titulo}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {r.texto}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── pagamentos ───────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              A mensalidade cai na conta da escola
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
              A conta de pagamentos é aberta no CNPJ da própria escola, junto ao
              Asaas. O responsável paga por Pix ou boleto, o sistema dá baixa
              sozinho e o dinheiro cai lá — sem passar pela gente em momento
              nenhum.
            </p>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Quem prefere continuar recebendo por fora não fica de lado: o
              faturamento e a inadimplência aparecem igual, com a baixa feita à
              mão em uma tela própria.
            </p>
          </div>

          <div className="rounded-xl border border-border p-6">
            <AsaasSelo fundo="claro" tamanho="md" />
            <p className="mt-4 text-sm text-muted-foreground">
              Serviços de pagamento prestados por Asaas Gestão Financeira
              Instituição de Pagamento S.A., instituição autorizada pelo Banco
              Central.
            </p>
          </div>
        </div>
      </section>

      {/* ── planos ───────────────────────────────────────────────────── */}
      <section id="planos" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-16 sm:py-20">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Planos
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Um preço só, com tudo incluído. Sem cobrança por aluno e sem taxa de
          implantação.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
          <Plano
            nome="Mensal"
            preco="R$ 390"
            periodo="por mês"
            detalhe="Cancela quando quiser."
          />
          <Plano
            nome="Anual"
            preco="R$ 4.212"
            periodo="por ano"
            detalhe="Equivale a R$ 351 por mês — um mês de desconto."
            destaque
          />
        </div>

        <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
          A conta de pagamentos é opcional e tem as taxas do próprio Asaas por
          recebimento, cobradas dele para a escola. Não há comissão nossa sobre
          a mensalidade dos alunos.
        </p>
      </section>

      {/* ── rodapé ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {PLATFORM_NAME}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {PLATFORM_TAGLINE}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <AsaasSelo fundo="claro" tamanho="sm" />
            <Link
              href="/login"
              className="text-sm font-medium text-primary hover:underline"
            >
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  /*
   * `flex-col-reverse` para o valor aparecer em cima com a ordem do DOM
   * correta embaixo (dt antes de dd). A primeira versão punha o rótulo num
   * `dt` escondido E num `dd` visível — leitor de tela lia duas vezes.
   */
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-0.5 text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-3xl font-bold tabular-nums text-foreground">
        {valor}
      </dd>
    </div>
  );
}

function Plano({
  nome,
  preco,
  periodo,
  detalhe,
  destaque,
}: {
  nome: string;
  preco: string;
  periodo: string;
  detalhe: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        destaque ? "border-2 border-primary" : "border-border"
      }`}
    >
      <p className="text-sm font-medium text-muted-foreground">{nome}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
        {preco}
      </p>
      <p className="text-sm text-muted-foreground">{periodo}</p>
      <p className="mt-3 text-sm text-muted-foreground">{detalhe}</p>
    </div>
  );
}
