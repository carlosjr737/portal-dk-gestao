import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ASAAS_ENV } from "@/features/baas/config";
import {
  consultarSaldoSubconta,
  estatisticasCobrancas,
} from "@/features/baas/asaas-client";
import {
  consultarDadosBancarios,
  consultarExtrato,
  consultarTaxas,
  listarCobrancas,
  listarSaques,
  type Cobranca,
  type Saque,
  type DadosBancarios,
  type Lancamento,
  type Taxas,
} from "@/features/baas/asaas-conta";

/**
 * Estado da conta de pagamentos. São quatro, e cada um manda numa tela
 * diferente — não são variações de mensagem.
 */
export type EstadoConta =
  | "sem_conta"
  | "em_analise"
  | "ativa"
  /** O provedor não reconhece mais a chave: conta apagada ou revogada. */
  | "nao_reconhecida";

/**
 * Uma linha do extrato, já agrupada por cobrança.
 *
 * Uma mensalidade gera vários lançamentos no provedor — o recebimento e a
 * taxa, no mínimo. Listados soltos, a escola jura que foi cobrada duas vezes.
 * Então a linha-pai carrega o líquido e o detalhe fica dentro dela.
 */
export type LinhaExtrato = {
  id: string;
  data: string;
  titulo: string;
  /** O que sobrou de fato deste grupo: recebimento menos o que foi descontado. */
  valor: number;
  /** Saldo DEPOIS do grupo inteiro. É o que faz a coluna fechar linha a linha. */
  saldoApos: number;
  detalhes: Array<{ rotulo: string; valor: number }>;
};

export type FaixaSituacao = {
  valor: number;
  /** O que sobra depois da taxa. É este que a escola recebe de fato. */
  valorLiquido: number;
  quantidade: number;
};

/**
 * As quatro situações de cobrança, separadas.
 *
 * RECEBIDA E CONFIRMADA NUNCA PODEM SER SOMADAS. Confirmada é dinheiro pago
 * que ainda não caiu — num cartão, cai no mês seguinte. A primeira versão
 * desta tela somava as duas sob o rótulo "Recebido em agosto", e passava a
 * dizer que a escola tinha recebido dinheiro que ainda não existia na conta
 * dela. É o mesmo descasamento que motivou tirar o cartão do leque.
 */
export type SituacaoCobrancas = {
  competencia: string;
  /** Dinheiro na conta. */
  recebidas: FaixaSituacao;
  /** Pago, ainda não creditado. */
  confirmadas: FaixaSituacao;
  aguardando: FaixaSituacao;
  vencidas: FaixaSituacao;
};

/** Cobrança já com o nome de quem paga, resolvido pelo nosso banco. */
export type CobrancaNaTela = Cobranca & { pagador: string | null };

export type ContaDigital = {
  estado: EstadoConta;
  /** Mensagem literal do provedor, quando ele recusa. Nunca resumida. */
  motivo: string | null;
  saldo: number;
  extrato: LinhaExtrato[];
  cobrancas: CobrancaNaTela[];
  saques: Saque[];
  situacao: SituacaoCobrancas | null;
  taxas: Taxas;
  dadosBancarios: DadosBancarios | null;
  ambiente: string;
};

/**
 * Rótulo de cada tipo de lançamento.
 *
 * "Taxa da plataforma" e nunca "tarifa": a Resolução Conjunta 16 (Art. 8º XI)
 * veda apresentar a cobrança como tarifa bancária. Vale em tela, recibo e
 * exportação.
 */
const ROTULO: Record<string, string> = {
  PAYMENT_RECEIVED: "Recebimento",
  PAYMENT_CONFIRMED: "Recebimento",
  PAYMENT_FEE: "Taxa da plataforma",
  INTERNAL_TRANSFER_DEBIT: "Comissão da plataforma",
  INTERNAL_TRANSFER_CREDIT: "Crédito",
  INTERNAL_TRANSFER_REVERSAL: "Estorno",
  TRANSFER: "Saque",
  PIX_TRANSACTION_DEBIT: "Pix enviado",
  PIX_TRANSACTION_DEBIT_REFUND: "Estorno de saque",
  PIX_TRANSACTION_CREDIT: "Pix recebido",
  PAYMENT_REFUND: "Estorno de cobrança",
  BILL_PAYMENT: "Pagamento de conta",
  MOBILE_PHONE_RECHARGE: "Recarga de celular",
};

function rotular(l: Lancamento): string {
  return ROTULO[l.tipo] ?? l.descricao ?? l.tipo;
}

/**
 * Agrupa os lançamentos por cobrança.
 *
 * O provedor devolve do mais novo para o mais antigo, e o `balance` de cada
 * linha é o saldo depois dela. Logo, o saldo resultante do grupo é o da
 * PRIMEIRA linha dele na lista — a mais recente.
 */
function agrupar(lancamentos: Lancamento[]): LinhaExtrato[] {
  const linhas: LinhaExtrato[] = [];
  const indicePorPagamento = new Map<string, number>();

  for (const l of lancamentos) {
    // Sem cobrança vinculada (saque, estorno), cada lançamento é uma linha.
    if (!l.paymentId) {
      linhas.push({
        id: l.id,
        data: l.data,
        titulo: rotular(l),
        valor: l.valor,
        saldoApos: l.saldoApos,
        detalhes: [],
      });
      continue;
    }

    const existente = indicePorPagamento.get(l.paymentId);
    if (existente === undefined) {
      indicePorPagamento.set(l.paymentId, linhas.length);
      linhas.push({
        id: l.paymentId,
        data: l.data,
        // O título definitivo vem do lançamento de recebimento, que aparece
        // depois na lista. Até lá, o rótulo do que veio primeiro serve.
        titulo: rotular(l),
        valor: l.valor,
        saldoApos: l.saldoApos,
        detalhes: [{ rotulo: rotular(l), valor: l.valor }],
      });
      continue;
    }

    const linha = linhas[existente];
    linha.valor += l.valor;
    linha.detalhes.push({ rotulo: rotular(l), valor: l.valor });
    // O recebimento é quem nomeia o grupo e quem dá a data da cobrança.
    if (l.tipo === "PAYMENT_RECEIVED" || l.tipo === "PAYMENT_CONFIRMED") {
      linha.titulo = l.descricao?.trim() || "Mensalidade";
      linha.data = l.data;
    }
  }

  // Dentro do grupo, o recebimento primeiro e os descontos depois — é a ordem
  // em que a pessoa lê a conta.
  for (const linha of linhas) {
    linha.detalhes.sort((a, b) => b.valor - a.valor);
  }

  return linhas;
}

function intervaloDoMes(hoje = new Date()) {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const dois = (n: number) => String(n).padStart(2, "0");
  return {
    de: `${ano}-${dois(mes + 1)}-01`,
    ate: `${ano}-${dois(mes + 1)}-${dois(new Date(ano, mes + 1, 0).getDate())}`,
    competencia: `${ano}-${dois(mes + 1)}`,
  };
}

/**
 * Tudo que a tela da conta precisa, numa consulta só.
 *
 * Falha de rede num pedaço não derruba a tela inteira: saldo, extrato e
 * resumo são pedidos em paralelo e cada um degrada sozinho. Só a rejeição da
 * CHAVE muda o estado da conta — porque aí não é falha, é a conta que não
 * existe mais.
 */
export async function getContaDigital(escolaId: string): Promise<ContaDigital> {
  const vazio = (
    estado: EstadoConta,
    motivo: string | null = null,
  ): ContaDigital => ({
    estado,
    motivo,
    saldo: 0,
    extrato: [],
    cobrancas: [],
    saques: [],
    situacao: null,
    taxas: { pix: null, boleto: null },
    dadosBancarios: null,
    ambiente: ASAAS_ENV,
  });

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("school_payment_credentials")
    .select("api_key, kyc_status")
    .eq("escola_id", escolaId)
    .eq("environment", ASAAS_ENV)
    .maybeSingle();

  const chave = (cred?.api_key as string | undefined) ?? null;
  if (!chave) return vazio("sem_conta");

  const saldo = await consultarSaldoSubconta(chave);

  // Chave rejeitada = a conta não existe mais, ou foi revogada. Não é "deu
  // erro na consulta": é o único sinal que sobra, porque o webhook mora
  // DENTRO da subconta e morre junto com ela.
  if (!saldo.ok && /401|403|inválid|invalid|não pertence/i.test(saldo.error)) {
    return vazio("nao_reconhecida", saldo.error);
  }

  const aprovada = String(cred?.kyc_status ?? "").toLowerCase() === "aprovada";
  const { de, ate, competencia } = intervaloDoMes();

  const [
    extrato,
    taxas,
    banco,
    cobrancas,
    saques,
    recebidas,
    confirmadas,
    pendentes,
    vencidas,
  ] = await Promise.all([
    consultarExtrato(chave, { limite: 60 }),
    consultarTaxas(chave),
    consultarDadosBancarios(chave),
    listarCobrancas(chave, { limite: 20 }),
    listarSaques(chave, 8),
    estatisticasCobrancas(chave, {
      status: "RECEIVED",
      vencimentoDe: de,
      vencimentoAte: ate,
    }),
    estatisticasCobrancas(chave, {
      status: "CONFIRMED",
      vencimentoDe: de,
      vencimentoAte: ate,
    }),
    estatisticasCobrancas(chave, {
      status: "PENDING",
      vencimentoDe: de,
      vencimentoAte: ate,
    }),
    estatisticasCobrancas(chave, {
      status: "OVERDUE",
      vencimentoDe: de,
      vencimentoAte: ate,
    }),
  ]);

  const faixa = (
    r: Awaited<ReturnType<typeof estatisticasCobrancas>>,
  ): FaixaSituacao =>
    r.ok
      ? {
          valor: r.valor,
          valorLiquido: r.valorLiquido,
          quantidade: r.quantidade,
        }
      : { valor: 0, valorLiquido: 0, quantidade: 0 };

  return {
    estado: aprovada ? "ativa" : "em_analise",
    motivo: null,
    saldo: saldo.ok ? saldo.saldo : 0,
    extrato: extrato.ok ? agrupar(extrato.lancamentos) : [],
    cobrancas: cobrancas.ok ? await comNomeDoPagador(cobrancas.cobrancas) : [],
    saques,
    situacao: {
      competencia,
      recebidas: faixa(recebidas),
      confirmadas: faixa(confirmadas),
      aguardando: faixa(pendentes),
      vencidas: faixa(vencidas),
    },
    taxas,
    dadosBancarios: banco,
    ambiente: ASAAS_ENV,
  };
}

/**
 * Troca o id do cliente no provedor pelo nome do responsável.
 *
 * O provedor devolve só o `customer`, que é um id opaco — uma lista de
 * `cus_000008568655` não diz a ninguém de quem é a cobrança. O nome sai do
 * nosso próprio banco, pelo vínculo que já existe em `aluno_assinatura`.
 *
 * Quem não tem vínculo (cobrança avulsa por QR, por exemplo) fica sem nome, e
 * a tela cai na descrição — que é justamente o que ela serve para dizer.
 */
async function comNomeDoPagador(
  cobrancas: Cobranca[],
): Promise<CobrancaNaTela[]> {
  const ids = [...new Set(cobrancas.map((c) => c.customerId).filter(Boolean))];
  if (ids.length === 0) return cobrancas.map((c) => ({ ...c, pagador: null }));

  const admin = createAdminClient();
  const { data } = await admin
    .from("aluno_assinatura")
    .select("asaas_customer_id, guardians(full_name)")
    .in("asaas_customer_id", ids);

  const nomePorCliente = new Map<string, string>();
  for (const linha of data ?? []) {
    const g = (linha as { guardians?: { full_name?: string } | null })
      .guardians;
    const nome = g?.full_name;
    const id = (linha as { asaas_customer_id?: string }).asaas_customer_id;
    if (id && nome) nomePorCliente.set(id, nome);
  }

  return cobrancas.map((c) => ({
    ...c,
    pagador: nomePorCliente.get(c.customerId) ?? null,
  }));
}
