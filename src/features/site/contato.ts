/**
 * Contato do site público.
 *
 * O objetivo de conversão da home é AGENDAR UMA DEMONSTRAÇÃO — não "ver
 * planos". Enquanto não existe agenda integrada (Cal.com, Calendly ou uma
 * rota própria), o botão leva para o WhatsApp que a empresa já usa: é o único
 * canal de contato que existe no projeto hoje, e mandar o visitante para um
 * formulário que ninguém lê seria pior que mandar para uma conversa real.
 *
 * A mensagem já vem escrita com a ORIGEM do clique. É atribuição pobre — o
 * texto pode ser apagado antes de enviar —, mas custa zero e responde "que
 * parte da página fez essa pessoa falar com a gente?" enquanto não há CRM nem
 * analytics instalado.
 */

export const WHATSAPP = "5531998413644";

/**
 * De onde partiu o clique. Vira sufixo da mensagem e valor do atributo
 * `data-origem`, que é o gancho para quando entrar uma ferramenta de
 * analytics (ver `EVENTO` abaixo).
 */
export type Origem =
  | "topo"
  | "hero"
  | "hero-mobile"
  | "barra-mobile"
  | "demonstracao"
  | "plano-mensal"
  | "plano-anual"
  | "final";

const ROTULO: Record<Origem, string> = {
  topo: "pelo menu do site",
  hero: "pela primeira tela do site",
  "hero-mobile": "pela primeira tela do site (celular)",
  "barra-mobile": "pela barra fixa do site (celular)",
  demonstracao: "pela seção de demonstração",
  "plano-mensal": "pelo plano mensal",
  "plano-anual": "pelo plano anual",
  final: "pelo fim do site",
};

/** Link de WhatsApp já com a mensagem e a origem embutidas. */
export function linkDemonstracao(origem: Origem) {
  const texto = `Olá! Quero agendar uma demonstração da Ale — cheguei ${ROTULO[origem]}.`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

/**
 * Atributos de mensuração nos CTAs.
 *
 * NÃO instala ferramenta nenhuma — o projeto não tem GA, GTM, Plausible nem
 * PostHog, e colocar uma aqui seria mexer em produção sem pedir. O que fica é
 * a marcação: no dia em que entrar um script de analytics, ele lê
 * `[data-evento]` e `[data-origem]` num listener só, sem precisar caçar
 * botão por botão nesta página.
 */
export function evento(nome: string, origem?: Origem) {
  return origem
    ? { "data-evento": nome, "data-origem": origem }
    : { "data-evento": nome };
}
