import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Email } from "@/features/email/client";
import { definicao, type ChaveTemplate } from "@/features/email/catalogo";
import { botao, moldura } from "@/features/email/templates";

/**
 * Monta o e-mail final: texto editável + variáveis + blocos fixos.
 *
 * ┌─ A ORDEM IMPORTA E É ESTA ──────────────────────────────────────────┐
 * │ 1. escapa o valor da variável                                       │
 * │ 2. só então substitui no corpo                                      │
 * │                                                                     │
 * │ Invertido, o nome de uma escola com "&" ou "<" quebraria o HTML do  │
 * │ e-mail — e um motivo de recusa vindo do Asaas é texto de terceiro   │
 * │ caindo dentro da nossa marcação. Escapar depois de juntar seria     │
 * │ escapar a própria marcação junto.                                   │
 * └─────────────────────────────────────────────────────────────────────┘
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escaparHtml(v: string): string {
  return v.replace(/[&<>"]/g, (c) => ESCAPES[c]);
}

/**
 * Troca `{variavel}` pelo valor.
 *
 * Variável sem valor vira string vazia, NUNCA fica com as chaves à mostra:
 * `{proximo_vencimento}` cru na caixa de entrada da escola parece defeito de
 * sistema — o que, a rigor, é.
 */
function substituir(
  texto: string,
  valores: Record<string, string>,
  escapar: boolean,
): string {
  return texto.replace(/\{([a-z_]+)\}/g, (_, nome: string) => {
    const v = valores[nome] ?? "";
    return escapar ? escaparHtml(v) : v;
  });
}

/**
 * Versão em texto puro do corpo.
 *
 * Cliente corporativo bloqueia HTML por padrão, e a mensagem que chega em
 * branco para o financeiro da escola é justamente a que não pode chegar em
 * branco. Converte a marcação mínima que o editor produz — nada mais existe
 * lá para converter.
 */
function paraTextoPuro(html: string): string {
  return html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|ul|ol|li|h\d)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type TextoDoTemplate = { assunto: string; corpo: string; personalizado: boolean };

/**
 * O texto em vigor para uma escola: o dela, se editou; senão o padrão.
 *
 * Falha de leitura NÃO derruba o envio — cai no padrão e registra. O e-mail
 * de suspensão não pode deixar de sair porque a tabela de personalização
 * está indisponível; texto padrão chegando é muito melhor que nada chegando.
 */
export async function textoEmVigor(
  chave: ChaveTemplate,
  escolaId: string | null,
): Promise<TextoDoTemplate> {
  const d = definicao(chave);
  const padrao = { assunto: d.assuntoPadrao, corpo: d.corpoPadrao, personalizado: false };

  // Sem escola não há personalização possível — é o caso da escola sendo
  // criada agora, que ainda não existia para editar texto nenhum.
  if (!escolaId) return padrao;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("email_template")
      .select("assunto, corpo")
      .eq("escola_id", escolaId)
      .eq("chave", chave)
      .maybeSingle();

    if (error) {
      console.error("[email] leitura do template falhou, usando padrão", {
        chave,
        erro: error.message,
      });
      return padrao;
    }
    if (!data) return padrao;

    return {
      assunto: data.assunto as string,
      corpo: data.corpo as string,
      personalizado: true,
    };
  } catch (e) {
    console.error("[email] template indisponível, usando padrão", { chave, erro: e });
    return padrao;
  }
}

/**
 * Renderiza o e-mail pronto para envio.
 *
 * O BOTÃO É BLOCO FIXO e por isso é montado aqui, não no texto: ele precisa
 * do HTML de tabela que o Outlook entende, e um `<a>` digitado no editor
 * chegaria como link solto no meio do parágrafo. O link dele sai da mesma
 * variável que o corpo usa — se ela vier vazia, o botão simplesmente não
 * aparece, em vez de virar um botão que não leva a lugar nenhum.
 */
export async function renderizar(p: {
  chave: ChaveTemplate;
  para: string;
  /** De quem é o texto. Sem escola, sai o padrão. */
  escolaId: string | null;
  valores: Record<string, string>;
  /** Para a prévia: usa o texto passado em vez do que está gravado. */
  rascunho?: { assunto: string; corpo: string };
}): Promise<Email> {
  const d = definicao(p.chave);
  const base = p.rascunho ?? (await textoEmVigor(p.chave, p.escolaId));

  const assunto = substituir(base.assunto, p.valores, false);
  const corpoHtml = substituir(base.corpo, p.valores, true);

  const linkDoBotao = d.botao ? (p.valores[d.botao.variavelDoLink] ?? "").trim() : "";
  const html = moldura(
    corpoHtml + (linkDoBotao ? botao(linkDoBotao, d.botao!.rotulo) : ""),
    paraTextoPuro(corpoHtml).split("\n")[0] ?? assunto,
  );

  const texto =
    paraTextoPuro(corpoHtml) + (linkDoBotao ? `\n\n${d.botao!.rotulo}: ${linkDoBotao}` : "");

  return { para: p.para, assunto, html, texto };
}
