import "server-only";

/**
 * O catálogo dos e-mails automáticos — a fonte da verdade da aba de
 * Comunicação.
 *
 * ┌─ POR QUE O TEXTO PADRÃO MORA EM CÓDIGO, E NÃO NO BANCO ─────────────┐
 * │ Se o padrão fosse uma linha gravada, "Restaurar padrão" dependeria  │
 * │ de essa linha existir e estar intacta. Banco novo, restore de       │
 * │ backup antigo ou um DELETE distraído deixariam a plataforma sem     │
 * │ texto nenhum — e o e-mail de cobrança sairia vazio. Em código, o    │
 * │ padrão é impossível de perder: o banco guarda só o que foi          │
 * │ PERSONALIZADO, e a ausência de linha significa "usa o padrão".      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * TEXTO GLOBAL, NÃO POR ESCOLA. Cinco dos seis e-mails são a plataforma
 * falando com a escola (cobrança, suspensão, conta aprovada) — deixar a
 * escola reescrever a carta de cobrança que ela própria recebe não faz
 * sentido. E a prova está na própria regra de variáveis obrigatórias:
 * "Usuário adicionado" exige `{escola}`. Variável para o nome da escola só
 * existe porque UM texto serve TODAS as escolas.
 */

export type Grupo = "acesso" | "assinatura" | "conta_pagamentos";

export type ChaveTemplate =
  | "acesso_criado"
  | "usuario_criado"
  | "assinatura_confirmada"
  | "assinatura_atrasada"
  | "assinatura_suspensa"
  | "conta_pagamentos";

export type Variavel = {
  nome: string;
  /** Rótulo do botão que insere. Ninguém decora sintaxe. */
  rotulo: string;
  /** Valor de mentira, para a prévia e para o envio de teste. */
  exemplo: string;
};

export type Obrigatoria = {
  nome: string;
  /**
   * POR QUE ELA É OBRIGATÓRIA, escrito para aparecer na tela do erro.
   * "Campo obrigatório" não ensina nada; a frase precisa dizer o estrago.
   */
  porque: string;
};

export type DefinicaoTemplate = {
  chave: ChaveTemplate;
  grupo: Grupo;
  /** Nome pelo MOMENTO em que sai, nunca pelo nome técnico da função. */
  nome: string;
  /** Uma linha dizendo quando dispara. Some a dúvida de "quando isso sai?". */
  quandoSai: string;
  assuntoPadrao: string;
  corpoPadrao: string;
  variaveis: Variavel[];
  obrigatorias: Obrigatoria[];
  /** Rótulo do botão fixo, quando o e-mail tem um. */
  botao: { rotulo: string; variavelDoLink: string } | null;
};

export const GRUPOS: Array<{ chave: Grupo; nome: string; descricao: string }> = [
  {
    chave: "acesso",
    nome: "Acesso",
    descricao: "Quando alguém ganha entrada no sistema.",
  },
  {
    chave: "assinatura",
    nome: "Assinatura da escola",
    descricao: "A cobrança mensal da plataforma para a escola.",
  },
  {
    chave: "conta_pagamentos",
    nome: "Conta de pagamentos",
    descricao: "O desfecho da análise da conta no Asaas.",
  },
];

/* Variáveis que aparecem em quase tudo — declaradas uma vez. */
const V_ESCOLA: Variavel = {
  nome: "escola",
  rotulo: "Nome da escola",
  exemplo: "Escola Exemplo",
};
const V_VALOR: Variavel = { nome: "valor", rotulo: "Valor", exemplo: "R$ 390,00" };

export const CATALOGO: DefinicaoTemplate[] = [
  {
    chave: "acesso_criado",
    grupo: "acesso",
    nome: "Acesso criado",
    quandoSai: "Assim que uma escola nova é cadastrada.",
    assuntoPadrao: "Seu acesso ao SouAle está pronto",
    corpoPadrao:
      "<p><strong>Seu acesso está pronto</strong></p>" +
      "<p>A conta da {escola} foi criada. Defina sua senha para entrar.</p>" +
      "<p>O link vale por tempo limitado. Se expirar, use “Esqueci minha senha” na tela de entrada.</p>",
    variaveis: [V_ESCOLA, { nome: "link_acesso", rotulo: "Link de acesso", exemplo: "https://souale.com.br/definir-senha" }],
    obrigatorias: [
      {
        nome: "link_acesso",
        porque:
          "Sem ele o e-mail anuncia a conta e não deixa entrar nela. A pessoa fica com um acesso que não abre.",
      },
    ],
    botao: { rotulo: "Definir minha senha", variavelDoLink: "link_acesso" },
  },
  {
    chave: "usuario_criado",
    grupo: "acesso",
    nome: "Usuário adicionado",
    quandoSai: "Quando a escola cadastra alguém da equipe.",
    assuntoPadrao: "Você foi adicionado ao sistema da {escola}",
    corpoPadrao:
      "<p><strong>Você tem acesso ao sistema</strong></p>" +
      "<p>Olá, {pessoa}. Você foi adicionado ao sistema da {escola} como {papel}.</p>" +
      "<p>A senha inicial foi definida por quem criou seu acesso — peça a ela e troque depois de entrar. <strong>Nunca pedimos senha por e-mail.</strong></p>",
    variaveis: [
      V_ESCOLA,
      { nome: "pessoa", rotulo: "Nome da pessoa", exemplo: "Marina" },
      { nome: "papel", rotulo: "Papel", exemplo: "Professor" },
      { nome: "link_acesso", rotulo: "Link de acesso", exemplo: "https://souale.com.br/login" },
    ],
    obrigatorias: [
      {
        nome: "escola",
        porque:
          "Quem dá aula em duas escolas recebe o mesmo e-mail das duas. Sem o nome, não dá para saber qual acesso é este.",
      },
      {
        nome: "link_acesso",
        porque: "Sem ele a pessoa sabe que tem acesso, mas não sabe por onde entrar.",
      },
    ],
    botao: { rotulo: "Entrar no sistema", variavelDoLink: "link_acesso" },
  },
  {
    chave: "assinatura_confirmada",
    grupo: "assinatura",
    nome: "Pagamento confirmado",
    quandoSai: "Quando o pagamento da mensalidade da plataforma é reconhecido.",
    assuntoPadrao: "Pagamento confirmado — SouAle",
    corpoPadrao:
      "<p><strong>Pagamento confirmado</strong></p>" +
      "<p>Recebemos o pagamento da assinatura da {escola}, no valor de {valor}.</p>" +
      "<p>A próxima cobrança vence em {proximo_vencimento}.</p>" +
      "<p>Nada a fazer — o acesso segue normal.</p>",
    variaveis: [
      V_ESCOLA,
      V_VALOR,
      { nome: "proximo_vencimento", rotulo: "Próximo vencimento", exemplo: "08/09/2026" },
    ],
    obrigatorias: [
      {
        nome: "valor",
        porque:
          "Recibo sem valor não serve de recibo. É o que a escola arquiva para conferir depois.",
      },
    ],
    botao: null,
  },
  {
    chave: "assinatura_atrasada",
    grupo: "assinatura",
    nome: "Assinatura em atraso",
    quandoSai: "No dia seguinte ao vencimento, se não houve baixa.",
    assuntoPadrao: "Assinatura em atraso — SouAle",
    corpoPadrao:
      "<p><strong>Assinatura em atraso</strong></p>" +
      "<p>A assinatura da {escola} venceu em {vencimento} e ainda consta em aberto. Valor: {valor}.</p>" +
      "<p>O acesso continua funcionando por {dias_de_carencia} dias. Depois disso é suspenso até o pagamento.</p>" +
      "<p>Se você já pagou nos últimos dias, ignore este aviso — a baixa pode levar algumas horas.</p>",
    variaveis: [
      V_ESCOLA,
      V_VALOR,
      { nome: "vencimento", rotulo: "Data de vencimento", exemplo: "05/08/2026" },
      { nome: "dias_de_carencia", rotulo: "Dias de carência", exemplo: "5" },
      { nome: "link_pagamento", rotulo: "Link de pagamento", exemplo: "https://www.asaas.com/i/exemplo" },
    ],
    obrigatorias: [
      {
        nome: "valor",
        porque: "Cobrança sem valor obriga a escola a perguntar quanto deve.",
      },
      {
        nome: "vencimento",
        porque: "Sem a data, a escola não consegue conferir se o aviso é do mês certo.",
      },
      {
        nome: "link_pagamento",
        porque:
          "Sem ele o e-mail avisa da dívida e não deixa pagar. Cobrança sem meio de pagar é pior que nenhuma cobrança.",
      },
    ],
    botao: { rotulo: "Pagar agora", variavelDoLink: "link_pagamento" },
  },
  {
    chave: "assinatura_suspensa",
    grupo: "assinatura",
    nome: "Acesso suspenso",
    quandoSai: "Quando passa a carência e a assinatura segue em aberto.",
    assuntoPadrao: "Acesso suspenso — SouAle",
    corpoPadrao:
      "<p><strong>Acesso suspenso</strong></p>" +
      "<p>O acesso da {escola} foi suspenso porque a assinatura segue em aberto além do prazo.</p>" +
      "<p><strong>Seus dados estão todos guardados.</strong> Assim que o pagamento for confirmado, o acesso volta sozinho.</p>" +
      "<p>Se precisar de prazo, é só responder este e-mail.</p>",
    variaveis: [
      V_ESCOLA,
      V_VALOR,
      { nome: "link_pagamento", rotulo: "Link de pagamento", exemplo: "https://www.asaas.com/i/exemplo" },
    ],
    obrigatorias: [
      {
        nome: "link_pagamento",
        porque:
          "Este é o e-mail de quem já está sem acesso. Sem o link, a escola precisa pedir para alguém o caminho de voltar.",
      },
    ],
    botao: { rotulo: "Pagar e reativar", variavelDoLink: "link_pagamento" },
  },
  {
    chave: "conta_pagamentos",
    grupo: "conta_pagamentos",
    nome: "Conta aprovada ou recusada",
    quandoSai: "Quando o Asaas conclui a análise da conta da escola.",
    assuntoPadrao: "Conta de pagamentos {desfecho} — SouAle",
    corpoPadrao:
      "<p><strong>Conta de pagamentos {desfecho}</strong></p>" +
      "<p>A conta da {escola} foi {desfecho} na análise.</p>" +
      "<p>{motivo}</p>",
    variaveis: [
      V_ESCOLA,
      { nome: "desfecho", rotulo: "Aprovada ou recusada", exemplo: "aprovada" },
      {
        nome: "motivo",
        rotulo: "Motivo",
        exemplo: "Já dá para cobrar as mensalidades pelo sistema.",
      },
    ],
    obrigatorias: [
      {
        nome: "motivo",
        porque:
          "Na recusa, o motivo vem literal do Asaas. Sem ele a escola abre chamado com a gente, e a plataforma vira suporte do provedor.",
      },
    ],
    botao: { rotulo: "Ver o que fazer", variavelDoLink: "link_painel" },
  },
];

export function definicao(chave: ChaveTemplate): DefinicaoTemplate {
  const d = CATALOGO.find((t) => t.chave === chave);
  if (!d) throw new Error(`template desconhecido: ${chave}`);
  return d;
}

/**
 * Quais obrigatórias estão faltando num texto.
 *
 * Confere assunto E corpo juntos: `{escola}` no assunto cumpre a exigência
 * tão bem quanto no corpo, e recusar isso obrigaria a repetir o nome duas
 * vezes só para o validador ficar satisfeito.
 */
export function faltandoObrigatorias(
  chave: ChaveTemplate,
  assunto: string,
  corpo: string,
): Obrigatoria[] {
  const texto = `${assunto}\n${corpo}`;
  return definicao(chave).obrigatorias.filter(
    (o) => !texto.includes(`{${o.nome}}`),
  );
}
