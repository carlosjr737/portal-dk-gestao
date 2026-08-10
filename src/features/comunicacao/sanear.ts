import "server-only";

/*
 * MÓDULO SEPARADO POR IMPOSIÇÃO DO FRAMEWORK, não por gosto.
 *
 * Em arquivo com "use server", TODO export vira endpoint e precisa ser
 * async — uma função síncrona ali quebra o build inteiro, com um erro que
 * o TypeScript não enxerga porque a regra é do Next, não do tipo.
 * Saneamento é cálculo puro: não deve ser endpoint nem virar async à toa.
 */

/**
 * SANEAMENTO DO HTML — a lista do que passa, não a do que barra.
 *
 * Lista de proibidos envelhece mal: basta uma tag nova, um atributo `on...`
 * esquecido ou uma variação de maiúsculas para abrir buraco. Aqui só as
 * marcações que a barra do editor produz sobrevivem, e o resto some — o que
 * também impede alguém de colar HTML do Word e mandar um e-mail com estilo
 * quebrado em nome da escola.
 *
 * `<a>` mantém só o `href`, e só http(s). `javascript:` num link de e-mail é
 * inútil para golpe (cliente de e-mail não executa), mas a mesma string
 * aparece na prévia, que roda no navegador.
 */
const TAGS_PERMITIDAS = new Set(["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"]);

export function sanearHtml(html: string): string {
  return html.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (tagInteira, nome: string, atributos: string) => {
    const tag = nome.toLowerCase();
    if (!TAGS_PERMITIDAS.has(tag)) return "";
    if (tagInteira.startsWith("</")) return `</${tag}>`;

    if (tag === "a") {
      const href = /href\s*=\s*["']([^"']*)["']/i.exec(atributos)?.[1]?.trim() ?? "";
      if (!/^https?:\/\//i.test(href)) return "<a>";
      return `<a href="${href.replace(/"/g, "&quot;")}">`;
    }
    return `<${tag}>`;
  });
}
