import "server-only";

import { ASAAS_API_BASE, getAsaasApiKey } from "@/features/baas/config";

/**
 * Forma de pagamento de uma cobrança.
 *
 * USE `BOLETO`. É o padrão da mensalidade, e o motivo não é óbvio:
 *
 * **Uma cobrança `BOLETO` sai com boleto E Pix na mesma fatura.** Conferido
 * na API — o `GET /payments/{id}/pixQrCode` de uma cobrança de boleto devolve
 * QR e copia-e-cola. No painel do provedor ela aparece como
 * "Boleto Bancário / Pix". Ou seja: `BOLETO` é, na prática, o "tudo menos
 * cartão" que o enum não nomeia.
 *
 * CARTÃO DE CRÉDITO NÃO ESTÁ NO TIPO, E É DE PROPÓSITO. O provedor repassa
 * cartão só depois da liquidação da bandeira, e parcelado vem mês a mês: a
 * escola dá a aula em agosto e recebe em setembro ou mais tarde, enquanto
 * paga o professor em agosto. É buraco de caixa criado pela forma de
 * pagamento, e nenhuma régua de inadimplência o enxerga.
 *
 * ⚠️ `UNDEFINED` É A PORTA DE ENTRADA DO CARTÃO. Ele oferece na fatura tudo
 * que estiver habilitado NA CONTA — e o cartão está. Foi assim que uma
 * mensalidade saiu no crédito sem ninguém ter pedido. Continua no tipo apenas
 * porque cobranças antigas foram criadas com ele; não use em código novo.
 */
export type FormaPagamento = "UNDEFINED" | "PIX" | "BOLETO";

export type AsaasSubcontaInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  companyType: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  /**
   * Nascimento do titular, `YYYY-MM-DD`. O Asaas exige em MEI e INDIVIDUAL,
   * onde quem responde pela conta é pessoa física. Faltava no payload: a
   * recusa vinha do provedor sem que nada na tela explicasse o porquê.
   */
  birthDate?: string;
  phone?: string;
  site?: string;
  complement?: string;
};

export type AsaasSubcontaResult =
  | {
      ok: true;
      id: string;
      walletId: string;
      apiKey: string | null;
    }
  | { ok: false; status: number; error: string };

/** Extrai a mensagem de erro do Asaas, que vem em formatos diferentes. */
function mensagemErro(data: unknown, status: number): string {
  const d = data as
    | { errors?: Array<{ description?: string }>; message?: string }
    | null;
  return (
    d?.errors?.[0]?.description ?? d?.message ?? `Erro ${status}`
  );
}

export async function criarSubcontaAsaas(
  input: AsaasSubcontaInput,
): Promise<AsaasSubcontaResult> {
  const apiKey = getAsaasApiKey();
  if (!apiKey) {
    return { ok: false, status: 0, error: "asaas_not_configured" };
  }

  const res = await fetch(`${ASAAS_API_BASE}/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, status: res.status, error: mensagemErro(data, res.status) };
  }

  return {
    ok: true,
    id: data.id as string,
    walletId: data.walletId as string,
    apiKey: (data.accessToken?.apiKey as string | undefined) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Fluxo 2 — assinatura da plataforma (plataforma cobra da escola)
//
// Usa a chave DA PLATAFORMA (env), não a da subconta: o dinheiro da assinatura
// é receita da plataforma e cai na conta dela. Não confundir com o Fluxo 1
// (escola cobra aluno, com split), que roda na subconta da escola.
// ---------------------------------------------------------------------------

export type ClienteAsaasInput = {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  province?: string;
  externalReference?: string;
  /**
   * Desliga as notificações do provedor para este cliente.
   *
   * Cada e-mail/SMS enviado por ele é cobrado (~R$ 0,50). Quando a escola
   * entrega a cobrança por conta própria (link/WhatsApp), pagar por isso é
   * desperdício — e o padrão do provedor é vir LIGADO.
   */
  notificationDisabled?: boolean;
};

export type ClienteAsaasResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * @param chave  Chave a usar. Omitida = a da PLATAFORMA (Fluxo 2, assinatura
 *               da escola). Informada = a da SUBCONTA da escola (Fluxo 1,
 *               mensalidade do aluno) — é o que faz o dinheiro cair direto
 *               na conta dela, sem passar pela plataforma.
 */
export async function criarClienteAsaas(
  input: ClienteAsaasInput,
  chave?: string,
): Promise<ClienteAsaasResult> {
  const apiKey = chave ?? getAsaasApiKey();
  if (!apiKey) return { ok: false, error: "asaas_not_configured" };

  const res = await fetch(`${ASAAS_API_BASE}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };
  return { ok: true, id: data.id as string };
}

export type AssinaturaAsaasInput = {
  customer: string;
  value: number;
  nextDueDate: string; // AAAA-MM-DD
  cycle: "MONTHLY" | "YEARLY";
  billingType: FormaPagamento;
  description?: string;
  externalReference?: string;
  /**
   * Data limite para gerar cobranças. Sem ela a assinatura cobraria PARA
   * SEMPRE — inclusive depois de a matrícula terminar. Vem do fim da
   * matrícula: matrícula até dezembro, cobrança até dezembro.
   */
  endDate?: string;
  /**
   * Split da taxa da plataforma. Hoje sempre ausente: a plataforma não retém
   * nada da mensalidade do aluno (decisão de negócio em aberto). O campo
   * existe para ligar isso sem refazer o fluxo.
   */
  split?: Array<{ walletId: string; percentualValue?: number; fixedValue?: number }>;
};

export type AssinaturaAsaasResult =
  | { ok: true; id: string; status: string; nextDueDate: string }
  | { ok: false; error: string };

/** @param chave  Ver `criarClienteAsaas`: omitida = plataforma; informada = subconta. */
export async function criarAssinaturaAsaas(
  input: AssinaturaAsaasInput,
  chave?: string,
): Promise<AssinaturaAsaasResult> {
  const apiKey = chave ?? getAsaasApiKey();
  if (!apiKey) return { ok: false, error: "asaas_not_configured" };

  const res = await fetch(`${ASAAS_API_BASE}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };
  return {
    ok: true,
    id: data.id as string,
    status: (data.status as string) ?? "ACTIVE",
    nextDueDate: (data.nextDueDate as string) ?? input.nextDueDate,
  };
}

/**
 * Registra o webhook DENTRO da subconta da escola.
 *
 * Sem isso, os pagamentos dos alunos não nos avisariam de nada: o webhook da
 * conta da plataforma só recebe eventos dela própria. Cada subconta precisa
 * do seu, apontando para o mesmo endpoint — o handler distingue os fluxos
 * pelo id da assinatura.
 */
export async function registrarWebhookSubconta(
  subcontaApiKey: string,
  url: string,
  authToken: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await fetch(`${ASAAS_API_BASE}/webhooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: subcontaApiKey },
    body: JSON.stringify({
      name: "Portal — cobranças",
      url,
      email: "contato@dkonline.app",
      enabled: true,
      interrupted: false,
      authToken,
      sendType: "NON_SEQUENTIALLY",
      // Não existe PAYMENT_RECEIVED_IN_CASH: a baixa manual dispara
      // PAYMENT_RECEIVED. Só o desfazimento tem evento próprio, e ele importa
      // — sem ele, uma baixa revertida deixaria a cobrança marcada como paga.
      events: [
        "PAYMENT_CREATED",
        "PAYMENT_CONFIRMED",
        "PAYMENT_RECEIVED",
        "PAYMENT_RECEIVED_IN_CASH_UNDONE",
        "PAYMENT_OVERDUE",
        "PAYMENT_REFUNDED",
        "PAYMENT_DELETED",
      ],
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };
  return { ok: true, id: data.id as string };
}

/**
 * Ajusta uma assinatura existente.
 *
 * O contrato do responsável é consolidado: uma matrícula nova soma ao mesmo
 * contrato. Quando isso acontece, o valor da assinatura precisa acompanhar —
 * senão a família continuaria pagando o valor antigo.
 *
 * `updatePendingPayments` faz a mudança valer também para a cobrança já
 * emitida e ainda não paga. Sem isso, o valor novo só entraria no mês
 * seguinte.
 */
export async function atualizarAssinaturaAsaas(
  subscriptionId: string,
  patch: { value?: number; endDate?: string; billingType?: FormaPagamento },
  chave?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = chave ?? getAsaasApiKey();
  if (!apiKey) return { ok: false, error: "asaas_not_configured" };

  const res = await fetch(`${ASAAS_API_BASE}/subscriptions/${subscriptionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({ ...patch, updatePendingPayments: true }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };
  return { ok: true };
}

/** Encerra a assinatura — usado quando a matrícula é cancelada. */
export async function cancelarAssinaturaAsaas(
  subscriptionId: string,
  chave?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = chave ?? getAsaasApiKey();
  if (!apiKey) return { ok: false, error: "asaas_not_configured" };

  const res = await fetch(`${ASAAS_API_BASE}/subscriptions/${subscriptionId}`, {
    method: "DELETE",
    headers: { access_token: apiKey },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { ok: false, error: mensagemErro(data, res.status) };
  }
  return { ok: true };
}

/**
 * Cobrança em aberto de uma assinatura, com o que é preciso para entregar ao
 * pagador: o link da fatura e, no caso do Pix, o copia-e-cola.
 *
 * Existe porque a escola entrega a cobrança por conta própria — as
 * notificações do provedor são cobradas por envio.
 */
export type CobrancaEmAberto = {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  billingType: string;
  /**
   * Data em que o dinheiro entrou de fato. `null` enquanto está em aberto.
   *
   * O provedor devolve três datas parecidas e elas NÃO são a mesma coisa:
   * `paymentDate` é quando a cobrança foi quitada, `confirmedDate` é quando a
   * confirmação chegou e `clientPaymentDate` é o que o pagador declarou. Para
   * a secretaria, o que importa é a primeira que existir — o resto é detalhe
   * de liquidação.
   */
  paymentDate: string | null;
  /** Página onde o responsável paga (Pix, boleto ou cartão). */
  invoiceUrl: string | null;
  /** Boleto em PDF, quando a forma permite. */
  bankSlipUrl: string | null;
};

export type CobrancasResult =
  | { ok: true; cobrancas: CobrancaEmAberto[] }
  | { ok: false; error: string };

export async function listarCobrancasAssinatura(
  subscriptionId: string,
  subcontaApiKey: string,
): Promise<CobrancasResult> {
  const res = await fetch(
    `${ASAAS_API_BASE}/subscriptions/${subscriptionId}/payments`,
    { headers: { access_token: subcontaApiKey } },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };

  const lista = (data?.data ?? []) as Array<Record<string, unknown>>;
  return {
    ok: true,
    cobrancas: lista.map((p) => ({
      id: p.id as string,
      status: (p.status as string) ?? "",
      value: Number(p.value ?? 0),
      dueDate: (p.dueDate as string) ?? "",
      billingType: (p.billingType as string) ?? "",
      paymentDate:
        (p.paymentDate as string | null) ??
        (p.confirmedDate as string | null) ??
        (p.clientPaymentDate as string | null) ??
        null,
      invoiceUrl: (p.invoiceUrl as string | null) ?? null,
      bankSlipUrl: (p.bankSlipUrl as string | null) ?? null,
    })),
  };
}

/**
 * Ajuste pontual de UMA cobrança já emitida — valor ou vencimento.
 *
 * Diferente de `atualizarAssinaturaAsaas`, que muda o combinado de todos os
 * meses. Aqui é o caso concreto da secretaria: "esse mês a família pagou
 * metade" ou "prorroga esse boleto para o dia 15". O mês seguinte volta ao
 * valor da assinatura, e é isso que se quer — senão um desconto de um mês
 * viraria desconto permanente sem ninguém decidir isso.
 *
 * `billingType` vai junto porque o endpoint de atualização o exige; mandamos
 * de volta o que a cobrança já tem, para não trocar a forma de pagamento sem
 * querer.
 */
export async function atualizarCobrancaAsaas(
  paymentId: string,
  patch: { value: number; dueDate: string; billingType: string },
  chave: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${ASAAS_API_BASE}/payments/${paymentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", access_token: chave },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };
  return { ok: true };
}

/** Pix copia-e-cola de uma cobrança, para quem prefere pagar sem abrir página. */
export async function obterPixCopiaECola(
  paymentId: string,
  subcontaApiKey: string,
): Promise<string | null> {
  const res = await fetch(`${ASAAS_API_BASE}/payments/${paymentId}/pixQrCode`, {
    headers: { access_token: subcontaApiKey },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data?.payload as string | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Onboarding / KYC da subconta
//
// ATENÇÃO: estes dois endpoints usam a chave DA SUBCONTA (não a da plataforma).
// É por isso que a api_key fica guardada em school_payment_credentials.
// ---------------------------------------------------------------------------

export type DocumentoPendente = {
  id: string;
  status: string;
  type: string;
  title: string;
  /** Quando presente, o envio é OBRIGATORIAMENTE por este link (não por API). */
  onboardingUrl: string | null;
};

export type DocumentosResult =
  | { ok: true; documentos: DocumentoPendente[] }
  | { ok: false; error: string };

export async function listarDocumentosSubconta(
  subcontaApiKey: string,
): Promise<DocumentosResult> {
  const res = await fetch(`${ASAAS_API_BASE}/myAccount/documents`, {
    headers: { access_token: subcontaApiKey },
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, error: mensagemErro(data, res.status) };
  }

  const lista = (data?.data ?? []) as Array<Record<string, unknown>>;
  return {
    ok: true,
    documentos: lista.map((d) => ({
      id: d.id as string,
      status: (d.status as string) ?? "PENDING",
      type: (d.type as string) ?? "",
      title: (d.title as string) ?? "",
      onboardingUrl: (d.onboardingUrl as string | null) ?? null,
    })),
  };
}

export type StatusSubcontaResult =
  | {
      ok: true;
      /** Só é 'APPROVED' quando tudo abaixo está aprovado. */
      general: string;
      documentation: string;
      commercialInfo: string;
      bankAccountInfo: string;
    }
  /*
   * O status HTTP sobe junto porque 401 aqui NÃO é "deu erro": é a conta que
   * não existe mais, ou a chave que foi revogada. Sem distinguir isso de uma
   * falha de rede, a tela continuaria mostrando "Aprovada" para uma subconta
   * apagada — e o webhook não salva, porque ele mora dentro da subconta e
   * morre junto com ela.
   */
  | { ok: false; error: string; status: number };

export async function consultarStatusSubconta(
  subcontaApiKey: string,
): Promise<StatusSubcontaResult> {
  const res = await fetch(`${ASAAS_API_BASE}/myAccount/status`, {
    headers: { access_token: subcontaApiKey },
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, error: mensagemErro(data, res.status), status: res.status };
  }

  return {
    ok: true,
    general: (data?.general as string) ?? "PENDING",
    documentation: (data?.documentation as string) ?? "PENDING",
    commercialInfo: (data?.commercialInfo as string) ?? "PENDING",
    bankAccountInfo: (data?.bankAccountInfo as string) ?? "PENDING",
  };
}

/* -------------------------------------------------------------------------
 * Leitura financeira da subconta.
 *
 * Todas usam a chave DA ESCOLA, não a da plataforma. Isso é uma consequência
 * do desenho de BaaS e vale entender: a plataforma não consegue ver as
 * cobranças da escola com a própria chave — tentar dá 404, e eu conferi. O
 * que ela tem é a chave da subconta guardada, e com ela consulta em nome da
 * escola.
 *
 * Ou seja: o dinheiro nunca passa pela plataforma, mas a leitura passa. São
 * coisas diferentes, e é bom que a escola saiba da segunda.
 * ---------------------------------------------------------------------- */

export type SaldoResult =
  | { ok: true; saldo: number }
  | { ok: false; error: string };

/** Saldo disponível na conta agora. */
export async function consultarSaldoSubconta(
  subcontaApiKey: string,
): Promise<SaldoResult> {
  const res = await fetch(`${ASAAS_API_BASE}/finance/balance`, {
    headers: { access_token: subcontaApiKey },
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, error: mensagemErro(data, res.status) };
  }

  return { ok: true, saldo: Number(data?.balance ?? 0) };
}

export type EstatisticaResult =
  | { ok: true; quantidade: number; valor: number; valorLiquido: number }
  | { ok: false; error: string };

/**
 * Soma das cobranças num status, opcionalmente num intervalo.
 *
 * `valorLiquido` é o que sobra depois da taxa do Asaas — é esse número que a
 * escola realmente recebe, e é ele que deve aparecer como "faturamento", não
 * o bruto. Mostrar o bruto infla o que a escola acha que ganhou.
 */
export type StatusCobranca =
  | "RECEIVED"
  | "CONFIRMED"
  | "RECEIVED_IN_CASH"
  | "PENDING"
  | "OVERDUE";

export async function estatisticasCobrancas(
  subcontaApiKey: string,
  filtros: {
    status?: StatusCobranca;
    /** Data de VENCIMENTO inicial, em ISO (2026-08-01). */
    vencimentoDe?: string;
    vencimentoAte?: string;
  } = {},
): Promise<EstatisticaResult> {
  const params = new URLSearchParams();
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.vencimentoDe) params.set("dueDate[ge]", filtros.vencimentoDe);
  if (filtros.vencimentoAte) params.set("dueDate[le]", filtros.vencimentoAte);

  const query = params.toString();
  const res = await fetch(
    `${ASAAS_API_BASE}/finance/payment/statistics${query ? `?${query}` : ""}`,
    { headers: { access_token: subcontaApiKey } },
  );
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, error: mensagemErro(data, res.status) };
  }

  return {
    ok: true,
    quantidade: Number(data?.quantity ?? 0),
    valor: Number(data?.value ?? 0),
    valorLiquido: Number(data?.netValue ?? 0),
  };
}
