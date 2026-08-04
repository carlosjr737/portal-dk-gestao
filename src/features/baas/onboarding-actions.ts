"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import {
  consultarStatusSubconta,
  listarDocumentosSubconta,
  type DocumentoPendente,
} from "@/features/baas/asaas-client";
import { ASAAS_ENV } from "@/features/baas/config";

export type OnboardingState = {
  ok?: boolean;
  message?: string;
  documentos?: DocumentoPendente[];
  statusGeral?: string;
  /** Itens que compõem a aprovação — mostram o que ainda falta. */
  etapas?: Array<{ nome: string; status: string }>;
};

/** Traduz o status do provedor para o vocabulário do cadastro da escola. */
function paraKycStatus(general: string): string {
  switch (general.toUpperCase()) {
    case "APPROVED":
      return "aprovada";
    case "REJECTED":
      return "recusada";
    case "AWAITING_APPROVAL":
      return "analise";
    default:
      return "analise";
  }
}

/**
 * Busca os documentos pendentes e o status da subconta, usando a chave DELA.
 *
 * NÃO EXISTE ENVIO DE DOCUMENTO POR AQUI, e a ausência de `onboardingUrl`
 * não autoriza um. Já foi tentado duas vezes, lendo a documentação como se
 * "sem link ⇒ manda por API" fosse regra geral. Não é: para selfie e
 * identificação o Asaas recusa o POST com "Esse tipo de documento não pode
 * ser enviado via API. Por favor, entre em contato com o suporte."
 *
 * Quando há `onboardingUrl`, a tela mostra o link. Quando não há, esses tipos
 * simplesmente não têm caminho self-service — vão pelo suporte do Asaas.
 */
export async function consultarOnboarding(): Promise<OnboardingState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Apenas admin pode consultar o cadastro." };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) {
    return { ok: false, message: "Seu usuário não está vinculado a uma escola." };
  }

  // A credencial vive numa tabela sem policy: só o backend (service_role) lê.
  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("school_payment_credentials")
    .select("api_key, account_id")
    .eq("escola_id", escolaId)
    .eq("environment", ASAAS_ENV)
    .maybeSingle();

  const apiKey = (cred?.api_key as string | undefined) ?? null;
  if (!apiKey) {
    return {
      ok: false,
      message: "Esta escola ainda não tem conta de pagamentos criada.",
    };
  }

  const [docs, status] = await Promise.all([
    listarDocumentosSubconta(apiKey),
    consultarStatusSubconta(apiKey),
  ]);

  /*
   * CHAVE REJEITADA = A CONTA NÃO EXISTE MAIS (ou a chave foi revogada).
   *
   * Isto não pode ser tratado como "deu erro na consulta", porque o efeito é
   * a tela continuar mostrando "Aprovada" para uma subconta que foi apagada
   * no painel do Asaas — e seguir oferecendo cobrança que nunca vai sair.
   *
   * E não adianta esperar webhook: o webhook é registrado DENTRO da subconta,
   * então ele morre junto com ela. Uma conta apagada não tem como avisar da
   * própria morte. A rejeição da chave é o único sinal que sobra, e é por
   * isso que ela vira estado gravado em vez de mensagem passageira.
   */
  if (!status.ok && (status.status === 401 || status.status === 403)) {
    /*
     * CONTA APAGADA NO ASAAS SAI DO BANCO TAMBÉM.
     *
     * A primeira versão disto só marcava `kyc_status = 'revogada'` e mantinha
     * a linha, com o raciocínio de que oferecer "criar conta" convidaria a
     * criar uma segunda subconta real por engano. O raciocínio vale quando a
     * conta EXISTE — aqui o provedor acabou de dizer que não existe. Manter a
     * linha deixava um beco sem saída: um registro morto, uma chave que não
     * abre nada, e nenhum caminho para frente.
     *
     * A credencial é apagada, não marcada. Ela guarda uma api_key que não
     * serve para nada e que o Asaas não devolve de novo — segredo morto é
     * risco sem contrapartida. Os identificadores saem de `school` junto,
     * senão o cadastro continua apontando para uma conta inexistente.
     *
     * O id vai para o log antes de sumir: se alguém precisar reclamar com o
     * Asaas sobre a conta apagada, é por ele que se procura.
     */
    console.error("BaaS: conta não reconhecida pelo provedor — registro removido", {
      escolaId,
      ambiente: ASAAS_ENV,
      accountId: (cred as { account_id?: string } | null)?.account_id ?? null,
      motivo: status.error,
    });

    await admin
      .from("school_payment_credentials")
      .delete()
      .eq("escola_id", escolaId)
      .eq("environment", ASAAS_ENV);

    /*
     * `school` guarda a ÚLTIMA conta criada, sem ambiente. Limpar só faz
     * sentido se a conta apagada é mesmo a que está registrada lá — senão a
     * exclusão da subconta de sandbox apagaria o vínculo da de produção.
     */
    const { data: escola } = await admin
      .from("school")
      .select("asaas_account_id")
      .eq("id", escolaId)
      .maybeSingle();

    const mesmaConta =
      escola?.asaas_account_id ===
      ((cred as { account_id?: string } | null)?.account_id ?? null);

    if (mesmaConta) {
      await admin
        .from("school")
        .update({
          asaas_account_id: null,
          asaas_wallet_id: null,
          kyc_status: null,
          // O módulo continua ligado: a escola quis cobrar pelo sistema, e
          // desligar sozinho esconderia as telas financeiras sem ninguém pedir.
          updated_at: new Date().toISOString(),
        })
        .eq("id", escolaId);
    }

    revalidatePath("/configuracoes/escola");
    revalidatePath("/financeiro/conta-pagamentos");
    revalidatePath("/financeiro");
    return {
      ok: false,
      statusGeral: "REVOKED",
      message:
        "O Asaas não reconhece mais esta conta — ela foi apagada ou a chave foi revogada. " +
        "O registro daqui foi removido; dá para criar uma conta nova.",
    };
  }

  if (!docs.ok) {
    return { ok: false, message: `Não foi possível listar os documentos: ${docs.error}` };
  }
  if (!status.ok) {
    return { ok: false, message: `Não foi possível consultar o status: ${status.error}` };
  }

  // Espelha o status do provedor, para a UI não depender de consultar a API
  // toda vez. Vai nos dois lugares: na credencial, porque a aprovação é DESTA
  // conta e a de sandbox não vale para produção; e em `school`, porque o
  // painel da plataforma lista as escolas por lá.
  const kyc = paraKycStatus(status.general);
  await Promise.all([
    admin
      .from("school_payment_credentials")
      .update({ kyc_status: kyc, updated_at: new Date().toISOString() })
      .eq("escola_id", escolaId)
      .eq("environment", ASAAS_ENV),
    admin
      .from("school")
      .update({ kyc_status: kyc, updated_at: new Date().toISOString() })
      .eq("id", escolaId),
  ]);

  revalidatePath("/configuracoes/escola");
  revalidatePath("/financeiro/conta-pagamentos");

  const pendentes = docs.documentos.filter(
    (d) => d.status.toUpperCase() !== "APPROVED",
  );

  return {
    ok: true,
    documentos: docs.documentos,
    statusGeral: status.general,
    etapas: [
      { nome: "Documentação", status: status.documentation },
      { nome: "Dados comerciais", status: status.commercialInfo },
      { nome: "Conta bancária", status: status.bankAccountInfo },
    ],
    message:
      status.general.toUpperCase() === "APPROVED"
        ? "Cadastro aprovado — a conta já pode receber."
        : pendentes.length === 0
          ? "Cadastro em análise, sem pendências suas."
          : `${pendentes.length} item(ns) de documentação a enviar.`,
  };
}
