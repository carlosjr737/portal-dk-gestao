/**
 * Selo "Serviços financeiros Asaas".
 *
 * Exigência do Playbook de BaaS do Asaas (item 6.1 do roadmap): toda tela que
 * movimente ou exiba valores precisa declarar quem presta o serviço
 * financeiro. Não é enfeite de rodapé — é a informação que separa "a escola
 * está te cobrando" de "quem processa o dinheiro é instituição autorizada", e
 * a Resolução Conjunta 16/2025 não dá prazo de adequação para contrato novo.
 *
 * ARQUIVO LOCAL, ARTE DO ASAAS
 * Os SVGs em `public/asaas/` são byte a byte os que o CDN do Asaas serve —
 * baixados de `baas.asaas.com/selos/…` e conferidos por hash, não
 * redesenhados. Ficam locais porque a URL do CDN responde `AccessDenied` sem
 * o parâmetro `id`: contrato frágil o bastante para o selo sumir sem ninguém
 * notar, e selo que some é violação silenciosa.
 *
 * URL oficial da conta aprovada, para constar no formulário de homologação:
 *   https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-{VARIANTE}.svg
 *     ?id=ba89535e-9857-4a97-87a4-eb41eb6076e7
 *
 * O `id` identifica a conta mas NÃO muda a arte: um id inventado devolve o
 * mesmo arquivo, conferido por hash. Uma cópia local serve todas as escolas —
 * o que muda por conta é o registro, não o desenho.
 */

type Fundo = "claro" | "escuro" | "mono";

const ARQUIVO: Record<Fundo, string> = {
  /** Azul e navy — sobre branco ou sobre o fundo da página. */
  claro: "/asaas/selo-positivo.svg",
  /** Todo branco — sobre índigo, cobalto ou qualquer superfície escura. */
  escuro: "/asaas/selo-negativo-branco.svg",
  /** Todo preto — impressão em preto e branco (contrato, recibo). */
  mono: "/asaas/selo-negativo-preto.svg",
};

/** Proporção original do arquivo: 188 × 69. */
const RAZAO = 188 / 69;

/*
 * 40px é o piso: abaixo disso a linha "Serviços financeiros" cai para menos
 * de 8px e deixa de ser legível. Um selo de conformidade ilegível cumpre o
 * requisito no código e não cumpre na tela — que é onde ele existe para ser
 * lido.
 */
const ALTURA = { sm: 40, md: 48 } as const;

export function AsaasSelo({
  fundo = "claro",
  tamanho = "sm",
  className = "",
}: {
  fundo?: Fundo;
  tamanho?: keyof typeof ALTURA;
  className?: string;
}) {
  const altura = ALTURA[tamanho];
  const largura = Math.round(altura * RAZAO);

  /*
   * O link para o Asaas é do Playbook: quem lê o selo precisa conseguir
   * chegar em quem presta o serviço. `noopener` porque abrir em aba nova sem
   * ele entrega `window.opener` ao destino.
   */
  return (
    <a
      href="https://asaas.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${className}`}
    >
      {/*
        SVG de tamanho fixo: o otimizador do next/image não tem o que fazer
        com vetor, e width/height explícitos já evitam o pulo de layout.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ARQUIVO[fundo]}
        alt="Serviços financeiros Asaas"
        width={largura}
        height={altura}
        style={{ width: largura, height: altura }}
      />
    </a>
  );
}
