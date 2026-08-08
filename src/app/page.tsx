import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardList,
  LayoutGrid,
  Receipt,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { AsaasSelo } from "@/components/brand/asaas-selo";
import { SouAleLogo } from "@/components/brand/souale-logo";
import { buttonVariants } from "@/components/ui/button";
import { BlocoProduto, Moldura } from "@/features/site/blocos";
import { evento, linkDemonstracao } from "@/features/site/contato";
import { Faq } from "@/features/site/faq";
import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/branding";

/**
 * Site público.
 *
 * A raiz redirecionava para `/dashboard`, então quem chegava sem login batia
 * na tela de entrar sem nunca saber o que o produto faz. Agora `/` é a página
 * pública e o portal continua em `/dashboard`.
 *
 * O QUE MUDOU NESTA VERSÃO. A página anterior apresentava o sistema com
 * honestidade e nada mais: uma lista do que ele faz, o preço e um botão. Ela
 * respondia "o que é isso?" e não respondia "por que eu?" nem "por que essa e
 * não uma genérica?". O objetivo de conversão passa a ser AGENDAR UMA
 * DEMONSTRAÇÃO — "ver planos" mandava o visitante para o preço antes de
 * existir valor construído, que é a ordem errada em venda de software para
 * escola.
 *
 * ESTÁTICA DE PROPÓSITO. O resto do sistema é `force-dynamic` porque toda
 * tela depende de sessão e banco; esta não depende de nada, e renderizar no
 * build é o que faz ela abrir rápido para quem chegou de busca ou anúncio.
 *
 * NENHUM NÚMERO AQUI É ENFEITE. Os dados de operação são de uma escola real
 * usando o sistema hoje. Depoimento inventado e logo de cliente que não
 * existe são o caminho mais curto para perder a conversa na primeira reunião
 * — e, num produto que oferece serviço financeiro, para queimar a análise do
 * provedor. Pelo mesmo motivo não há aqui promessa de prazo de suporte nem
 * declaração de conformidade: o que não está no contrato não entra na página.
 */

/*
 * ISR de um dia. A página continua servida como arquivo estático; o que a
 * revalidação resolve é o ano do rodapé, que sem isso congelaria na data do
 * último deploy — "© 2026" em fevereiro de 2027 é o tipo de detalhe que faz o
 * visitante achar que o produto foi abandonado.
 */
export const revalidate = 86400;

const TITULO = `${PLATFORM_NAME} | Gestão para escolas de dança, música e teatro`;
const DESCRICAO =
  "Organize alunos, famílias, turmas, chamadas, mensalidades e inadimplência em um sistema criado para escolas de dança, música e teatro.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  metadataBase: new URL(PLATFORM_URL),
  alternates: { canonical: "/" },
  keywords: [
    "sistema para escola de dança",
    "gestão de escola de música",
    "software para escola de teatro",
    "controle de mensalidades escola de artes",
    "chamada digital professor",
  ],
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    url: PLATFORM_URL,
    siteName: PLATFORM_NAME,
    locale: "pt_BR",
    type: "website",
    /*
       Sem isto o link compartilhado no WhatsApp aparecia como texto puro. A
       imagem é a marca sobre o Índigo com a chamada da página — 1200×630, a
       proporção que WhatsApp, LinkedIn e Twitter recortam sem cortar nada.
    */
    images: [
      {
        url: "/marca/og.png",
        width: 1200,
        height: 630,
        alt: "SouAle — gestão para escolas de dança, música e teatro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
    images: ["/marca/og.png"],
  },
};

/*
 * Dados estruturados. Só afirma o que a página afirma: nome, categoria, e o
 * preço que está na seção de planos. Sem `aggregateRating` — nota agregada
 * exige avaliação real e pública, e inventar uma é caso de penalização, não
 * de rich result.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: PLATFORM_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: PLATFORM_URL,
  description: DESCRICAO,
  inLanguage: "pt-BR",
  offers: {
    "@type": "Offer",
    price: "390",
    priceCurrency: "BRL",
    category: "subscription",
  },
};

const MENU = [
  { href: "#como-funciona", rotulo: "Como funciona" },
  { href: "#funcionalidades", rotulo: "Funcionalidades" },
  { href: "#pagamentos", rotulo: "Pagamentos" },
  { href: "#planos", rotulo: "Planos" },
  { href: "#duvidas", rotulo: "Dúvidas" },
] as const;

const SEM_ALE = [
  "Informações espalhadas em planilhas e cadernos.",
  "Dificuldade para acompanhar mensalidades.",
  "Chamadas feitas de formas diferentes.",
  "Pouca clareza sobre ocupação e evasão.",
  "Trabalho manual para localizar informações.",
] as const;

const COM_ALE = [
  "Dados de alunos e famílias centralizados.",
  "Matrículas e turmas organizadas.",
  "Chamadas feitas pelo professor.",
  "Mensalidades e inadimplência visíveis.",
  "Informações para tomar decisões com segurança.",
] as const;

/*
 * Blocos de benefício.
 *
 * O PROJETO TEM UMA CAPTURA DE TELA SÓ — a do financeiro, com nomes
 * fictícios. Em vez de desenhar interface que não existe, cada bloco usa um
 * RECORTE real dessa tela, enquadrado no pedaço que o texto está falando. Os
 * recortes foram gerados do PNG original, sem redesenho e sem retoque: é a
 * mesma tela, mais perto.
 */
const BLOCOS = [
  {
    titulo: "Toda a vida do aluno em um só lugar.",
    texto:
      "Organize alunos, responsáveis, famílias, matrículas e informações importantes sem depender de diferentes arquivos.",
    imagem: {
      src: "/screens/nav-alunos.png",
      alt: "Menu do sistema com Alunos, Matrículas, Turmas, Chamada e Financeiro",
      width: 620,
      height: 640,
    },
  },
  {
    titulo: "A rotina das turmas fica mais simples.",
    texto:
      "Acompanhe professores, horários, capacidade, ocupação e chamadas com uma visão clara da operação.",
    imagem: {
      src: "/screens/turmas-ocupacao.png",
      alt: "Painel de ocupação por turma, com vagas preenchidas em cada horário",
      width: 540,
      height: 400,
    },
  },
  {
    titulo: "Saiba quem pagou e quem precisa de atenção.",
    texto:
      "Visualize mensalidades, pagamentos e inadimplência sem precisar conferir diferentes planilhas.",
    imagem: {
      src: "/screens/financeiro-kpis.png",
      alt: "Indicadores de faturamento contratado, recebido, em atraso e a vencer",
      width: 930,
      height: 380,
    },
  },
  {
    titulo: "Informações para decidir, não apenas para arquivar.",
    texto:
      "Enxergue o que está acontecendo na escola e identifique rapidamente os pontos que precisam da sua atenção.",
    imagem: {
      src: "/screens/decisoes.png",
      alt: "Ocupação por turma ao lado da lista de inadimplência, com dias de atraso e valor",
      width: 930,
      height: 400,
    },
  },
] as const;

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
    Icone: LayoutGrid,
    titulo: "Salas e rodízio",
    texto:
      "A grade de horários por sala montada arrastando a turma, com choque de sala e de professor aparecendo na hora.",
  },
  {
    Icone: Wallet,
    titulo: "Pagamento de professores",
    texto:
      "Hora-aula e variável por aluno calculadas no mês, com a planilha pronta para conferir antes de pagar.",
  },
] as const;

const INCLUSO = [
  "Alunos, responsáveis, famílias e matrículas, sem limite de cadastro.",
  "Turmas, salas, rodízio de horários e chamada digital.",
  "Mensalidades, recebimentos, inadimplência e pagamento de professores.",
  "Métricas de ocupação, evasão e faturamento.",
  "Importação da base atual por planilha.",
  "Todas as pessoas da escola com acesso — sem cobrança por usuário.",
] as const;

export default function SitePage() {
  const ano = new Date().getFullYear();

  return (
    /*
      `pb-20 lg:pb-0`: a barra fixa do celular flutua sobre o conteúdo, e sem
      essa folga ela cobria a última linha do rodapé. No desktop a barra não
      existe e a folga também não.
    */
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ── topo ─────────────────────────────────────────────────────── */}
      {/*
        Fixo no topo. Numa página de treze seções, um cabeçalho que sobe junto
        com a rolagem leva o CTA embora justamente quando a pessoa acabou de
        ler o argumento que a convenceu.
      */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          {/*
            O logotipo substitui o quadrado com "A" e o nome em texto: ele já
            É os dois. Link para a raiz porque logo de cabeçalho é o caminho
            de volta que todo mundo tenta primeiro.
          */}
          <Link href="/" className="rounded" aria-label={`${PLATFORM_NAME} — início`}>
            <SouAleLogo altura={32} />
          </Link>

          {/*
            O menu some abaixo de `lg` em vez de virar sanduíche: são cinco
            âncoras para a mesma página, e um menu que só faz rolar não vale o
            JavaScript nem o botão. No celular quem carrega a conversão é a
            barra fixa lá embaixo.
          */}
          <nav
            className="hidden items-center gap-1 lg:flex"
            aria-label="Seções da página"
          >
            {MENU.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {item.rotulo}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              {...evento("ja-sou-cliente")}
            >
              Já sou cliente
            </Link>
            <a
              href={linkDemonstracao("topo")}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm", className: "hidden sm:inline-flex" })}
              {...evento("agendar-demonstracao", "topo")}
            >
              Agendar uma demonstração
            </a>
          </div>
        </div>
      </header>

      {/* ── hero ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-14 pt-12 sm:pt-16 lg:pb-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-12">
          <div>
            {/*
              Para QUEM, antes de o quê. Quem administra escola de dança já
              testou dois sistemas genéricos e desistiu dos dois; a primeira
              linha existe para essa pessoa saber, em um segundo, que desta
              vez é sobre ela.
            */}
            <p className="text-sm font-semibold text-primary">
              Gestão para escolas de dança, música e teatro
            </p>

            <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              Sou a Ale. Organizo alunos, turmas e mensalidades em um só lugar.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Tenha matrículas, chamadas, mensalidades, inadimplência e ocupação
              das turmas organizadas, sem depender de planilhas e cadernos.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={linkDemonstracao("hero")}
                target="_blank"
                rel="noopener noreferrer"
                /*
                  `size: "lg"` em vez de h-12/px-6 à mão. O className passado
                  POR DENTRO do buttonVariants não passa pelo twMerge — o cva
                  só concatena.
                */
                className={buttonVariants({ size: "lg" })}
                {...evento("agendar-demonstracao", "hero")}
              >
                Agendar uma demonstração
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </a>
              <a
                href="#como-funciona"
                className={buttonVariants({ variant: "outline", size: "lg" })}
                {...evento("ver-como-funciona")}
              >
                Ver como funciona
              </a>
            </div>

            {/*
              Microcopy embaixo do botão, não dentro dele. "Sem compromisso" é
              o que responde ao medo real de quem clica: não é o preço, é
              virar alvo de vendedor.
            */}
            <p className="mt-4 text-sm text-muted-foreground">
              Conheça a Ale em uma demonstração rápida e sem compromisso.
            </p>
          </div>

          {/*
            A tela do produto, dois enquadramentos.
            A versão anterior escondia a imagem no celular — e o celular é
            onde chega a maior parte de quem vem de anúncio, ou seja, a maior
            parte das pessoas não via um pixel do sistema. O recorte de
            celular tira a barra lateral e sobra o que se lê a 340px: os
            números grandes. Os dois levam `priority` porque cada um é o LCP
            do seu tamanho de tela.
          */}
          <Moldura
            src="/screens/painel.png"
            alt="Tela do financeiro da Ale, com faturamento, ocupação por turma e lista de inadimplência"
            width={1200}
            height={760}
            priority
            className="hidden lg:block"
          />
          <Moldura
            src="/screens/painel-mobile.png"
            alt="Indicadores de faturamento, recebido e em atraso, com a ocupação das turmas"
            width={695}
            height={380}
            priority
            className="lg:hidden"
          />
        </div>
      </section>

      {/* ── prova ────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Criada e validada dentro da rotina real de uma escola de artes.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                A Ale não nasceu apenas de uma ideia. Ela foi desenvolvida
                acompanhando, todos os dias, a operação de uma escola com
                centenas de alunos, famílias, turmas e professores.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
              <Numero valor="665" rotulo="matrículas" />
              <Numero valor="433" rotulo="famílias" />
              <Numero valor="52" rotulo="turmas" />
              <Numero valor="14" rotulo="professores" />
            </dl>
          </div>
        </div>
      </section>

      {/* ── antes e depois ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Menos improviso. Mais controle sobre a sua escola.
        </h2>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/*
            A coluna do problema NÃO é um card branco igual ao da solução. Se
            as duas têm o mesmo peso, a comparação vira decoração simétrica e
            o olho não escolhe lado. Aqui: a de cima é plana, sem fundo; a de
            baixo é card, com a borda na cor da marca.

            Vermelho na lista do problema e verde na da solução seguem a regra
            da identidade — cor semântica marca ESTADO, e a marca (cobalto)
            nunca é usada para dizer "ruim" ou "bom".
          */}
          <div className="rounded-xl border border-border p-6 sm:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sem a Ale
            </h3>
            <ul className="mt-5 space-y-4">
              {SEM_ALE.map((item) => (
                <li key={item} className="flex gap-3 text-base text-muted-foreground">
                  <X
                    className="mt-0.5 h-5 w-5 shrink-0 text-danger-text"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border-2 border-primary bg-card p-6 sm:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
              Com a Ale
            </h3>
            <ul className="mt-5 space-y-4">
              {COM_ALE.map((item) => (
                <li key={item} className="flex gap-3 text-base text-foreground">
                  <Check
                    className="mt-0.5 h-5 w-5 shrink-0 text-success-text"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── como funciona ────────────────────────────────────────────── */}
      <section
        id="como-funciona"
        className="scroll-mt-20 border-y border-border bg-card"
      >
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            O sistema por dentro
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            As telas abaixo são do produto em uso — com nomes fictícios, porque
            print é público e nome de aluno é dado pessoal.
          </p>

          <div className="mt-14 space-y-16 sm:space-y-24">
            {BLOCOS.map((bloco, i) => (
              <BlocoProduto
                key={bloco.titulo}
                indice={i + 1}
                titulo={bloco.titulo}
                texto={bloco.texto}
                imagem={bloco.imagem}
                inverter={i % 2 === 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── funcionalidades ──────────────────────────────────────────── */}
      <section
        id="funcionalidades"
        className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 sm:py-20"
      >
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          E o resto da operação junto
        </h2>
        <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* ── origem ───────────────────────────────────────────────────── */}
      {/*
        Índigo, a segunda cor da marca. Esta é a seção que separa a Ale de um
        ERP genérico, então ela recebe o único bloco escuro do meio da página
        — peso visual proporcional ao peso do argumento.
      */}
      <section className="bg-inverse">
        <div className="mx-auto max-w-4xl px-6 py-20 sm:py-24">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            Criada por quem vive a rotina de uma escola de artes.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/80">
            Sistemas genéricos nem sempre entendem como uma escola de dança,
            música ou teatro realmente funciona. A Ale foi desenvolvida dentro
            dessa rotina, considerando alunos, famílias, professores, turmas,
            chamadas, mensalidades e todas as decisões que fazem parte do dia a
            dia de uma escola.
          </p>
          <p className="mt-6 border-l-2 border-white/40 pl-5 text-lg font-medium leading-relaxed text-white">
            Por isso, cada funcionalidade começa em uma necessidade real.
          </p>
        </div>
      </section>

      {/* ── pagamentos ───────────────────────────────────────────────── */}
      {/*
        Encolhido de propósito. Na versão anterior o Asaas ocupava uma faixa
        inteira com selo grande e dois parágrafos de conformidade — e ficava
        maior que a própria Ale. O que o visitante precisa saber aqui cabe em
        um parágrafo: o dinheiro é dele. O detalhe operacional foi para o FAQ.
      */}
      <section
        id="pagamentos"
        className="scroll-mt-20 border-b border-border bg-card"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              O dinheiro vai direto para a conta da sua escola.
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              A conta é aberta no CNPJ da própria escola e os pagamentos são
              processados pelo Asaas. A Ale ajuda a organizar a cobrança, mas o
              dinheiro continua pertencendo e sendo recebido diretamente pela
              escola.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 rounded-xl border border-border p-5">
            <AsaasSelo fundo="claro" tamanho="sm" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Serviços de pagamento prestados por Asaas Gestão Financeira
              Instituição de Pagamento S.A., autorizada pelo Banco Central.
            </p>
          </div>
        </div>
      </section>

      {/* ── demonstração ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="rounded-xl border border-border bg-card p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Veja como a Ale funciona na rotina da sua escola.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                Em uma demonstração rápida, mostramos como organizar alunos,
                turmas, chamadas e mensalidades e respondemos às dúvidas da sua
                operação.
              </p>
              {/*
                Sem vídeo: não existe gravação do sistema no projeto, e montar
                uma peça de vídeo fictícia seria inventar produto. Quando a
                gravação existir, ela entra aqui.
              */}
              <a
                href={linkDemonstracao("demonstracao")}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "lg", className: "mt-8" })}
                {...evento("agendar-demonstracao", "demonstracao")}
              >
                Quero conhecer a Ale
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </a>
            </div>

            <ul className="space-y-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              {[
                "Como a sua base de alunos entra no sistema.",
                "Como fica a chamada no celular do professor.",
                "Como a cobrança e a inadimplência aparecem no mês.",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-success-text"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── planos ───────────────────────────────────────────────────── */}
      <section
        id="planos"
        className="scroll-mt-20 border-y border-border bg-card"
      >
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Um plano, tudo incluído
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Sem cobrança por aluno, sem cobrança por usuário e sem taxa de
            implantação.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
              <Plano
                nome="Mensal"
                preco="R$ 390"
                sufixo=" /mês"
                periodo="cobrado todo mês"
                detalhe="Cancela quando quiser."
                origem="plano-mensal"
              />
              <Plano
                nome="Anual"
                selo="1 mês grátis"
                preco="R$ 351"
                sufixo=" /mês"
                periodo="cobrado R$ 4.212 ao ano"
                origem="plano-anual"
                destaque
              />
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground">
                O que está incluído
              </h3>
              <ul className="mt-4 space-y-3">
                {INCLUSO.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-success-text"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <dl className="mt-8 space-y-4 border-t border-border pt-6 text-sm">
                <Condicao termo="Taxa de implantação">
                  Não há. O preço do plano é o preço total.
                </Condicao>
                <Condicao termo="Suporte">
                  Direto pelo WhatsApp, no mesmo número desta página.
                </Condicao>
                <Condicao termo="Cancelamento">
                  No plano mensal, quando você quiser. No anual, conforme o
                  contrato — o desconto está amarrado ao período.
                </Condicao>
                <Condicao termo="Conta de pagamentos">
                  Opcional. Tem as taxas do próprio Asaas por recebimento,
                  cobradas dele para a escola. Não há comissão nossa sobre a
                  mensalidade dos alunos.
                </Condicao>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── dúvidas ──────────────────────────────────────────────────── */}
      <section
        id="duvidas"
        className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 sm:py-20"
      >
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Dúvidas
        </h2>
        <Faq />
      </section>

      {/* ── chamada final ────────────────────────────────────────────── */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            Sua escola pode crescer sem a gestão virar um problema.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Conheça a Ale e veja como centralizar alunos, turmas, chamadas e
            mensalidades em uma operação mais simples e segura.
          </p>
          <a
            href={linkDemonstracao("final")}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "lg", className: "mt-8" })}
            {...evento("agendar-demonstracao", "final")}
          >
            Agendar uma demonstração
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
          </a>
          <p className="mt-4 text-sm text-muted-foreground">
            Demonstração rápida e sem compromisso.
          </p>
        </div>
      </section>

      {/* ── rodapé ───────────────────────────────────────────────────── */}
      {/*
        Índigo, a segunda cor da marca. A classe é `bg-inverse` e não
        `bg-surface-inverse`: o token `--surface-inverse` está mapeado no
        Tailwind sob a chave `inverse`. A classe com o nome do token não
        existe, e usá-la deixaria o rodapé transparente com texto branco por
        cima — ilegível, e sem erro nenhum para avisar.

        NÃO HÁ AQUI CNPJ, POLÍTICA DE PRIVACIDADE, TERMOS DE USO NEM REDES
        SOCIAIS. Não é esquecimento: nenhum desses dados existe no projeto, e
        um link para uma página que não foi escrita é pior que a ausência dele
        — quebra na primeira vez que alguém clica. Entram assim que existirem.
      */}
      <footer className="bg-inverse">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              {/* Negativa: "Sou" em branco e "Ale" em lavanda, a versão que o
                  manual pede sobre Índigo. */}
              <SouAleLogo fundo="escuro" altura={32} />
              <p className="mt-3 max-w-xs text-sm text-white/70">
                Gestão para escolas de dança, música e teatro.
              </p>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <p className="font-semibold text-white">Fale com a gente</p>
              {/*
                Branco, não `text-primary`: cobalto sobre índigo dá 2,65:1 e
                reprova até como componente não-textual. E o anel de foco
                global também é cobalto, então ele é trocado por branco aqui —
                senão o foco de teclado desaparece exatamente onde o link
                está.
              */}
              <a
                href={linkDemonstracao("final")}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                {...evento("abrir-whatsapp")}
              >
                WhatsApp (31) 99841-3644
              </a>
              <Link
                href="/login"
                className="rounded text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                {...evento("ja-sou-cliente")}
              >
                Já sou cliente
              </Link>
            </div>

            {/* Selo branco: o positivo é navy sobre azul e some no índigo. */}
            <AsaasSelo fundo="escuro" tamanho="sm" />
          </div>

          <p className="mt-10 border-t border-white/10 pt-6 text-xs text-white/60">
            © {ano} {PLATFORM_NAME}. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* ── barra fixa do celular ────────────────────────────────────── */}
      {/*
        Discreta: uma faixa de 64px com o CTA e nada mais. Não sobrepõe
        conteúdo (o wrapper reserva o espaço) e não tem botão de fechar —
        fechar exigiria estado, e estado aqui exigiria transformar a página
        inteira em client component por causa de uma faixa.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <a
          href={linkDemonstracao("barra-mobile")}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ className: "w-full" })}
          {...evento("agendar-demonstracao", "barra-mobile")}
        >
          Agendar uma demonstração
        </a>
      </div>
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
      <dt className="mt-1 text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-4xl font-bold tabular-nums text-foreground">
        {valor}
      </dd>
    </div>
  );
}

function Condicao({
  termo,
  children,
}: {
  termo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="font-semibold text-foreground">{termo}</dt>
      <dd className="mt-1 leading-relaxed text-muted-foreground">{children}</dd>
    </div>
  );
}

function Plano({
  nome,
  preco,
  sufixo,
  periodo,
  detalhe,
  selo,
  origem,
  destaque,
}: {
  nome: string;
  preco: string;
  sufixo?: string;
  periodo: string;
  detalhe?: string;
  selo?: string;
  origem: "plano-mensal" | "plano-anual";
  destaque?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-6 ${
        destaque ? "border-2 border-primary" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-muted-foreground">{nome}</p>
        {/*
          A borda destacava o card e nada dizia por quê. O selo é o motivo,
          escrito.
        */}
        {selo ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {selo}
          </span>
        ) : null}
      </div>

      {/*
        O número grande é o mensal, mesmo no plano anual: R$ 4.212 é o valor
        certo e a âncora errada — assusta antes de explicar. O total anual
        continua na linha de baixo, porque é o que vai ser cobrado.
      */}
      <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
        {preco}
        {sufixo ? (
          <span className="text-base font-medium text-muted-foreground">
            {sufixo}
          </span>
        ) : null}
      </p>
      <p className="text-sm text-muted-foreground">{periodo}</p>
      {detalhe ? (
        <p className="mt-3 text-sm text-muted-foreground">{detalhe}</p>
      ) : null}

      {/*
        "Agendar uma demonstração" e não "Comprar agora": não há checkout, e o
        começo depende de importar a base da escola. Um botão de compra que
        abre uma conversa é promessa quebrada no primeiro clique.
      */}
      <a
        href={linkDemonstracao(origem)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({
          variant: destaque ? "default" : "outline",
          size: "lg",
          className: "mt-5 w-full",
        })}
        {...evento("agendar-demonstracao", origem)}
      >
        Agendar uma demonstração
      </a>
    </div>
  );
}
