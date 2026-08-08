/**
 * Marca SouAle.
 *
 * O símbolo junta três leituras numa forma só: o contorno desenha um "a"
 * minúsculo (Ale, a assistente), a curva envolve como cuidado — sem apelar
 * para cadeado ou escudo — e o check diz operação concluída. No logotipo,
 * "Ale" ganha o Cobalto e mais peso: o produto não é um portal genérico.
 *
 * AS CORES DA MARCA JÁ ERAM AS DO PRODUTO. Índigo #25265B é o
 * `--surface-inverse` e Cobalto #5B5CE2 é o `--primary`, sem um dígito de
 * diferença. Isso não é coincidência feliz: significa que a marca e a
 * interface foram desenhadas na mesma paleta, e o logo não vai brigar com
 * nenhuma tela.
 *
 * POR QUE `<img>` E NÃO SVG EM LINHA
 * O wordmark está convertido em curvas (não depende da Manrope instalada) e
 * por isso o arquivo tem quilobytes de path. Em linha, esse peso entraria em
 * TODO HTML que renderiza o cabeçalho; como arquivo, o navegador baixa uma
 * vez e reusa em todas as páginas. É o mesmo raciocínio do selo do Asaas.
 *
 * QUAL VERSÃO USAR — regra do manual da marca:
 *   claro   fundo branco ou o fundo da página
 *   escuro  sobre Índigo ou foto escura ("Sou" branco, "Ale" lavanda)
 *   mono    impressão em uma cor
 *
 * E abaixo de 96px de largura o manual pede só o SÍMBOLO: nesse tamanho o
 * wordmark vira um borrão e o "a" some junto. Por isso `apenasSimbolo`
 * existe — e por isso `Logo` avisa no console de desenvolvimento quando
 * alguém pede a versão completa pequena demais.
 */

type Fundo = "claro" | "escuro" | "mono";

/** Proporções originais dos arquivos. */
const LOGO = { largura: 325, altura: 104 };
const SIMBOLO = { largura: 108, altura: 108 };

const ARQUIVO_LOGO: Record<Fundo, string> = {
  claro: "/marca/logo.svg",
  escuro: "/marca/logo-negativa.svg",
  mono: "/marca/logo-mono.svg",
};

const ARQUIVO_SIMBOLO: Record<Fundo, string> = {
  claro: "/marca/simbolo.svg",
  escuro: "/marca/simbolo-negativo.svg",
  /* Não há símbolo monocromático no kit; o de fundo claro é o mais próximo. */
  mono: "/marca/simbolo.svg",
};

/** Largura mínima do logotipo completo, segundo o manual. */
const MINIMO_COMPLETO = 96;

export function SouAleLogo({
  fundo = "claro",
  altura = 32,
  apenasSimbolo = false,
  className = "",
}: {
  fundo?: Fundo;
  /** Altura em px. A largura sai da proporção do arquivo. */
  altura?: number;
  apenasSimbolo?: boolean;
  className?: string;
}) {
  const base = apenasSimbolo ? SIMBOLO : LOGO;
  const largura = Math.round((altura * base.largura) / base.altura);

  if (process.env.NODE_ENV !== "production" && !apenasSimbolo && largura < MINIMO_COMPLETO) {
    console.warn(
      `SouAleLogo: ${largura}px de largura fica abaixo do mínimo de ${MINIMO_COMPLETO}px ` +
        `do manual — nesse tamanho o wordmark vira borrão. Use apenasSimbolo.`,
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={(apenasSimbolo ? ARQUIVO_SIMBOLO : ARQUIVO_LOGO)[fundo]}
      alt="SouAle"
      width={largura}
      height={altura}
      style={{ width: largura, height: altura }}
      className={className}
    />
  );
}
