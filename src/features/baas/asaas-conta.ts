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
  const d = data as
    | { errors?: Array<{ description?: string }>; message?: string }
    | null;
  return d?.errors?.[0]?.description ?? d?.message ?? `Erro ${status}`;
}

async function ler<T>(
  caminho: string,
  chave: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const res = await fetch(`${ASAAS_API_BASE}${caminho}`, {
    headers: headers(chave),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: mensagemErro(data, res.status), status: res.status };
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
  const r = await ler<Record<string, unknown>>("/myAccount/accountNumber", chave);
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
export type Taxas = { pix: number | null; boleto: number | null };

export async function consultarTaxas(chave: string): Promise<Taxas> {
  const r = await ler<Record<string, unknown>>("/myAccount/fees", chave);
  if (!r.ok) return { pix: null, boleto: null };

  const pagamento = (r.data.payment ?? {}) as Record<string, unknown>;
  const boleto = (pagamento.bankSlip ?? {}) as Record<string, unknown>;
  const pix = (pagamento.pix ?? {}) as Record<string, unknown>;

  // `discountValue` é o valor vigente quando há desconto ativo na conta; o
  // `defaultValue` é o de tabela. A escola paga o vigente.
  const vigente = (o: Record<string, unknown>) => {
    const desconto = o.discountValue;
    const padrao = o.defaultValue ?? o.fixedFee;
    const v = desconto ?? padrao;
    return v === null || v === undefined ? null : Number(v);
  };

  return { pix: vigente(pix), boleto: vigente(boleto) };
}

/* ------------------------------------------------------------------ */
/* Pix de recebimento                                                  */
/* ------------------------------------------------------------------ */

/**
 * Chave Pix da conta. A subconta nasce com uma chave aleatória (EVP) ativa,
 * então na prática esta consulta sempre devolve algo — mas o QR estático
 * precisa de uma chave explícita, e sem ela o provedor recusa.
 */
export async function primeiraChavePixAtiva(chave: string): Promise<string | null> {
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
  | { ok: true; qr: QrCodeEstatico }
  | { ok: false; error: string };

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
