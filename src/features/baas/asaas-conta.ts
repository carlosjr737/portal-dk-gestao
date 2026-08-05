import "server-only";

import { ASAAS_API_BASE } from "@/features/baas/config";

/**
 * Leitura da conta de pagamentos da escola — saldo, extrato, dados bancários,
 * taxas e Pix de recebimento.
 *
 * Fica separado de `asaas-client.ts` porque é outro assunto: aquele trata de
 * cobrar (cliente, assinatura, subconta), este trata do dinheiro depois que
 * ele chega. Todas as funções usam a chave DA ESCOLA — a plataforma não
 * enxerga a conta dela com a própria chave.
 *
 * O que NÃO está aqui, e por quê: saque, pagamento de conta, Pix de saída e
 * recarga. Os endpoints existem e a subconta tem acesso, mas todos param numa
 * autorização que a API não expõe (`authorized: false`, sem endpoint para
 * autorizar). Medido em 04/08/2026 — ver o adendo do ADR 0001. Enquanto isso
 * não destravar, oferecer essas funções seria prender o dinheiro da escola.
 */

function headers(chave: string) {
  return { "Content-Type": "application/json", access_token: chave };
}

function mensagemErro(data: unknown, status: number): string {
  const d = data as {
    errors?: Array<{ description?: string }>;
    message?: string;
  } | null;
  return d?.errors?.[0]?.description ?? d?.message ?? `Erro ${status}`;
}

async function ler<T>(
  caminho: string,
  chave: string,
): Promise<
  { ok: true; data: T } | { ok: false; error: string; status: number }
> {
  const res = await fetch(`${ASAAS_API_BASE}${caminho}`, {
    headers: headers(chave),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      error: mensagemErro(data, res.status),
      status: res.status,
    };
  }
  return { ok: true, data: data as T };
}

/* ------------------------------------------------------------------ */
/* Extrato                                                             */
/* ------------------------------------------------------------------ */

/**
 * Um lançamento do extrato, como o provedor devolve.
 *
 * `balance` é o saldo DEPOIS deste lançamento. É o que permite a coluna de
 * saldo fechar linha a linha — extrato cujo saldo não fecha é extrato em que
 * ninguém confia.
 */
export type Lancamento = {
  id: string;
  data: string;
  tipo: string;
  descricao: string;
  valor: number;
  saldoApos: number;
  /** Presente quando o lançamento pertence a uma cobrança. É a chave do agrupamento. */
  paymentId: string | null;
  transferId: string | null;
};

export type ExtratoResult =
  | { ok: true; lancamentos: Lancamento[]; total: number }
  | { ok: false; error: string };

export async function consultarExtrato(
  chave: string,
  opcoes: { limite?: number; offset?: number } = {},
): Promise<ExtratoResult> {
  const params = new URLSearchParams({
    // O provedor devolve no máximo 100 por página.
    limit: String(Math.min(opcoes.limite ?? 50, 100)),
    offset: String(opcoes.offset ?? 0),
  });

  const r = await ler<{ data?: unknown[]; totalCount?: number }>(
    `/financialTransactions?${params}`,
    chave,
  );
  if (!r.ok) return { ok: false, error: r.error };

  const lista = (r.data.data ?? []) as Array<Record<string, unknown>>;
  return {
    ok: true,
    total: Number(r.data.totalCount ?? lista.length),
    lancamentos: lista.map((t) => ({
      id: String(t.id ?? ""),
      data: String(t.date ?? ""),
      tipo: String(t.type ?? ""),
      descricao: String(t.description ?? ""),
      valor: Number(t.value ?? 0),
      saldoApos: Number(t.balance ?? 0),
      paymentId: (t.paymentId as string | null) ?? null,
      transferId: (t.transferId as string | null) ?? null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Dados bancários e taxas                                             */
/* ------------------------------------------------------------------ */

export type DadosBancarios = { agencia: string; conta: string; digito: string };

export async function consultarDadosBancarios(
  chave: string,
): Promise<DadosBancarios | null> {
  const r = await ler<Record<string, unknown>>(
    "/myAccount/accountNumber",
    chave,
  );
  if (!r.ok) return null;
  return {
    agencia: String(r.data.agency ?? ""),
    conta: String(r.data.account ?? ""),
    digito: String(r.data.accountDigit ?? ""),
  };
}

/**
 * Taxas que a escola paga POR RECEBIMENTO.
 *
 * Nunca chamar isso de "tarifa" em tela: a Resolução Conjunta 16 (Art. 8º XI)
 * veda apresentar a cobrança como tarifa bancária. O rótulo é
 * "taxa da plataforma".
 */
export type Taxas = {
  pix: number | null;
  boleto: number | null;
  /**
   * Recebimentos Pix sem taxa por mês, e quantos já foram usados.
   *
   * Não é detalhe: com 100 grátis por mês, a escola pequena não paga taxa
   * nenhuma de Pix. Mostrar só "R$ 0,99" faria a conta parecer mais cara do
   * que é, e ainda esconderia o momento em que a taxa passa a valer.
   */
  pixGratisPorMes: number | null;
  pixUsadosNoMes: number | null;
};

export async function consultarTaxas(chave: string): Promise<Taxas> {
  const vazio: Taxas = {
    pix: null,
    boleto: null,
    pixGratisPorMes: null,
    pixUsadosNoMes: null,
  };

  const r = await ler<Record<string, unknown>>("/myAccount/fees", chave);
  if (!r.ok) return vazio;

  const pagamento = (r.data.payment ?? {}) as Record<string, unknown>;
  const boleto = (pagamento.bankSlip ?? {}) as Record<string, unknown>;
  const pix = (pagamento.pix ?? {}) as Record<string, unknown>;

  /*
   * PIX E BOLETO USAM NOMES DIFERENTES PARA A MESMA COISA.
   *
   *   boleto -> defaultValue     / discountValue
   *   pix    -> fixedFeeValue    / fixedFeeValueWithDiscount
   *
   * Ler só os nomes do boleto fazia a taxa de Pix voltar nula, e a tela
   * mostrava "—" ao lado de "Recebimento por Pix" — que qualquer um lê como
   * "grátis" ou "não disponível", quando a taxa existe e é a mesma do boleto.
   */
  const vigente = (o: Record<string, unknown>) => {
    const desconto = o.discountValue ?? o.fixedFeeValueWithDiscount;
    const padrao = o.defaultValue ?? o.fixedFeeValue ?? o.fixedFee;
    const v = desconto ?? padrao;
    return v === null || v === undefined ? null : Number(v);
  };

  const numero = (v: unknown) =>
    v === null || v === undefined ? null : Number(v);

  return {
    pix: vigente(pix),
    boleto: vigente(boleto),
    pixGratisPorMes: numero(pix.monthlyCreditsWithoutFee),
    pixUsadosNoMes: numero(pix.creditsReceivedOfCurrentMonth),
  };
}

/* ------------------------------------------------------------------ */
/* Pix de recebimento                                                  */
/* ------------------------------------------------------------------ */

/**
 * Chave Pix da conta. A subconta nasce com uma chave aleatória (EVP) ativa,
 * então na prática esta consulta sempre devolve algo — mas o QR estático
 * precisa de uma chave explícita, e sem ela o provedor recusa.
 */
export async function primeiraChavePixAtiva(
  chave: string,
): Promise<string | null> {
  const r = await ler<{ data?: unknown[] }>("/pix/addressKeys", chave);
  if (!r.ok) return null;
  const lista = (r.data.data ?? []) as Array<Record<string, unknown>>;
  const ativa = lista.find(
    (k) => String(k.status ?? "").toUpperCase() === "ACTIVE",
  );
  return (ativa?.key as string | undefined) ?? null;
}

export type QrCodeEstatico = {
  id: string;
  /** Pix copia-e-cola. */
  payload: string;
  /** PNG em base64, sem o prefixo `data:`. */
  imagemBase64: string | null;
};

export type QrCodeResult =
  { ok: true; qr: QrCodeEstatico } | { ok: false; error: string };

/**
 * QR Code Pix avulso — cobrança que não é mensalidade.
 *
 * Existe porque figurino, taxa de festival e aula avulsa não passam por
 * contrato nem por assinatura, e hoje a escola não tem por onde cobrá-los
 * dentro do sistema.
 */
export async function criarQrCodeEstatico(
  chave: string,
  entrada: { addressKey: string; valor: number; descricao: string },
): Promise<QrCodeResult> {
  const res = await fetch(`${ASAAS_API_BASE}/pix/qrCodes/static`, {
    method: "POST",
    headers: headers(chave),
    body: JSON.stringify({
      addressKey: entrada.addressKey,
      description: entrada.descricao,
      value: entrada.valor,
      format: "ALL",
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };

  const d = data as Record<string, unknown>;
  return {
    ok: true,
    qr: {
      id: String(d.id ?? ""),
      payload: String(d.payload ?? ""),
      imagemBase64: (d.encodedImage as string | undefined) ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Cobranças                                                           */
/* ------------------------------------------------------------------ */

/**
 * Uma cobrança emitida pela escola.
 *
 * `netValue` é o que sobra depois da taxa — é ele que a escola recebe, e é ele
 * que deve aparecer como resultado. O bruto serve de referência, não de
 * promessa.
 *
 * `creditDate` é quando o dinheiro fica disponível, e num cartão isso é o mês
 * seguinte. É a diferença entre "confirmada" e "recebida", e é o motivo de os
 * dois estados nunca poderem ser somados.
 */
export type Cobranca = {
  id: string;
  customerId: string;
  status: string;
  formaPagamento: string;
  valor: number;
  valorLiquido: number;
  vencimento: string;
  descricao: string;
  /** Quando o dinheiro cai na conta. Nulo enquanto não houver previsão. */
  creditoEm: string | null;
  estornada: boolean;
};

export type CobrancasResult =
  { ok: true; cobrancas: Cobranca[] } | { ok: false; error: string };

export async function listarCobrancas(
  chave: string,
  opcoes: { limite?: number } = {},
): Promise<CobrancasResult> {
  const params = new URLSearchParams({
    limit: String(Math.min(opcoes.limite ?? 20, 100)),
    offset: "0",
  });

  const r = await ler<{ data?: unknown[] }>(`/payments?${params}`, chave);
  if (!r.ok) return { ok: false, error: r.error };

  const lista = (r.data.data ?? []) as Array<Record<string, unknown>>;
  return {
    ok: true,
    cobrancas: lista.map((p) => ({
      id: String(p.id ?? ""),
      customerId: String(p.customer ?? ""),
      status: String(p.status ?? ""),
      formaPagamento: String(p.billingType ?? ""),
      valor: Number(p.value ?? 0),
      valorLiquido: Number(p.netValue ?? 0),
      vencimento: String(p.dueDate ?? ""),
      descricao: String(p.description ?? ""),
      creditoEm: (p.creditDate as string | null) ?? null,
      estornada: Array.isArray(p.refunds) && p.refunds.length > 0,
    })),
  };
}

export type EstornoResult =
  { ok: true; status: string } | { ok: false; error: string };

/**
 * Estorna uma cobrança — devolve o dinheiro a quem pagou.
 *
 * Vale para cobrança recebida ou confirmada. No cartão, o valor é debitado do
 * saldo da conta e o cancelamento aparece na fatura de quem pagou em até dez
 * dias úteis.
 *
 * ATENÇÃO — a taxa NÃO volta. O provedor não devolve taxa de compensação nem
 * de notificação, então estornar R$ 452,00 custa à escola os R$ 9,48 da taxa.
 * A tela precisa dizer isso antes, não depois.
 */
export async function estornarCobranca(
  chave: string,
  paymentId: string,
  motivo?: string,
): Promise<EstornoResult> {
  const res = await fetch(`${ASAAS_API_BASE}/payments/${paymentId}/refund`, {
    method: "POST",
    headers: headers(chave),
    body: JSON.stringify(motivo ? { description: motivo } : {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };
  return {
    ok: true,
    status: String((data as Record<string, unknown>)?.status ?? "REFUNDED"),
  };
}

/* ------------------------------------------------------------------ */
/* Saque                                                               */
/* ------------------------------------------------------------------ */

export type TipoChavePix = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export type DonoDaChave = {
  nome: string;
  /** Vem mascarado do provedor: `***.444.777-**`. Nunca completo. */
  cpfCnpj: string;
  banco: string;
};

/**
 * De quem é esta chave Pix?
 *
 * É a trava contra o erro que não tem volta. Pix cai na hora e não se
 * desfaz: um dígito trocado manda a mensalidade inteira para um
 * desconhecido. Mostrar o nome do titular antes de confirmar transforma um
 * erro de digitação em "não é essa pessoa" — e a escola cancela.
 */
export async function consultarChavePix(
  chaveApi: string,
  tipo: TipoChavePix,
  chavePix: string,
): Promise<{ ok: true; dono: DonoDaChave } | { ok: false; error: string }> {
  const params = new URLSearchParams({ type: tipo, key: chavePix });
  const r = await ler<Record<string, unknown>>(
    `/pix/addressKeys/external?${params}`,
    chaveApi,
  );
  if (!r.ok) return { ok: false, error: r.error };

  const dono = (r.data.owner ?? {}) as Record<string, unknown>;
  const inst = (r.data.financialInstitution ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    dono: {
      nome: String(dono.name ?? "").trim(),
      cpfCnpj: String(dono.cpfCnpj ?? ""),
      banco: String(inst.name ?? r.data.ispbName ?? ""),
    },
  };
}

export type Saque = {
  id: string;
  valor: number;
  valorLiquido: number;
  taxa: number;
  status: string;
  /** `false` = travado esperando a liberação da validação de saque. */
  autorizado: boolean;
  criadoEm: string;
  destino: string | null;
  comprovanteUrl: string | null;
  podeCancelar: boolean;
};

function paraSaque(t: Record<string, unknown>): Saque {
  const ba = (t.bankAccount ?? {}) as Record<string, unknown>;
  return {
    id: String(t.id ?? ""),
    valor: Number(t.value ?? 0),
    valorLiquido: Number(t.netValue ?? 0),
    taxa: Number(t.transferFee ?? 0),
    status: String(t.status ?? ""),
    autorizado: t.authorized === true,
    criadoEm: String(t.dateCreated ?? ""),
    destino: (ba.ownerName as string | null) ?? null,
    comprovanteUrl: (t.transactionReceiptUrl as string | null) ?? null,
    podeCancelar: t.canBeCancelled === true,
  };
}

export async function criarSaque(
  chaveApi: string,
  entrada: { valor: number; tipo: TipoChavePix; chavePix: string },
): Promise<{ ok: true; saque: Saque } | { ok: false; error: string }> {
  const res = await fetch(`${ASAAS_API_BASE}/transfers`, {
    method: "POST",
    headers: headers(chaveApi),
    body: JSON.stringify({
      value: entrada.valor,
      pixAddressKey: entrada.chavePix,
      pixAddressKeyType: entrada.tipo,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };
  return { ok: true, saque: paraSaque(data as Record<string, unknown>) };
}

export async function listarSaques(
  chaveApi: string,
  limite = 10,
): Promise<Saque[]> {
  const r = await ler<{ data?: unknown[] }>(
    `/transfers?limit=${limite}&offset=0`,
    chaveApi,
  );
  if (!r.ok) return [];
  return ((r.data.data ?? []) as Array<Record<string, unknown>>).map(paraSaque);
}

export async function cancelarSaque(
  chaveApi: string,
  saqueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${ASAAS_API_BASE}/transfers/${saqueId}/cancel`, {
    method: "POST",
    headers: headers(chaveApi),
    body: "{}",
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => null);
  return { ok: false, error: mensagemErro(data, res.status) };
}
