import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { criarClienteAsaas } from "@/features/baas/asaas-client";
import { clientePorDocumento } from "@/features/baas/asaas-conta";
import { motivoDocumentoInvalido } from "@/lib/documento";

/**
 * Descobre — ou cria — o cadastro de um responsável no provedor.
 *
 * QUEM MANDA É O NOSSO CADASTRO. A escola pensa em responsável financeiro,
 * não em "cliente do Asaas"; o cadastro lá é consequência, e o sistema
 * resolve sozinho. Por isso toda tela que cobra parte de `guardians` e chama
 * esta função na hora de emitir.
 *
 * A ordem importa e é a trava contra duplicar a pessoa:
 *
 *   1. já temos o vínculo guardado  -> usa
 *   2. existe lá com este documento -> reaproveita
 *   3. não existe                   -> cria
 *
 * Pular o passo 2 criaria uma segunda ficha com o mesmo CPF, e a partir daí o
 * histórico da família fica partido em duas — sem forma de juntar depois.
 */

export type ResolucaoCliente =
  | { ok: true; customerId: string; nome: string; telefone: string | null }
  | { ok: false; motivo: string };

export async function resolverClienteDoResponsavel(
  chaveApi: string,
  guardianId: string,
  escolaId: string,
): Promise<ResolucaoCliente> {
  const admin = createAdminClient();

  const { data: guardian } = await admin
    .from("guardians")
    .select("id, full_name, document, email, phone, escola_id")
    .eq("id", guardianId)
    .maybeSingle();

  if (!guardian) return { ok: false, motivo: "Responsável não encontrado." };
  // O admin client ignora RLS: a fronteira de escola é conferida na mão.
  if (guardian.escola_id !== escolaId) {
    return { ok: false, motivo: "Responsável não pertence à sua escola." };
  }

  const nome = (guardian.full_name as string) ?? "";
  const telefone = (guardian.phone as string | null) ?? null;

  // 1. vínculo que já guardamos
  const { data: vinculo } = await admin
    .from("aluno_assinatura")
    .select("asaas_customer_id")
    .eq("guardian_id", guardianId)
    .not("asaas_customer_id", "is", null)
    .limit(1)
    .maybeSingle();

  const guardado = (vinculo?.asaas_customer_id as string | undefined) ?? null;
  if (guardado) return { ok: true, customerId: guardado, nome, telefone };

  /*
   * Daqui para baixo o documento é obrigatório: o provedor não emite cobrança
   * sem CPF ou CNPJ válido. Conferir aqui faz a recusa dizer de quem é o
   * problema e onde arrumar, em vez de vir crua de lá.
   */
  const motivo = motivoDocumentoInvalido(guardian.document);
  if (motivo) return { ok: false, motivo: `${nome} ${motivo}.` };

  const documento = String(guardian.document);

  // 2. já existe lá com este documento?
  const existente = await clientePorDocumento(chaveApi, documento);
  if (existente) {
    return { ok: true, customerId: existente, nome, telefone };
  }

  // 3. cria
  const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
  const criado = await criarClienteAsaas(
    {
      name: nome,
      cpfCnpj: soDigitos(documento),
      email: (guardian.email as string | null) ?? undefined,
      mobilePhone: soDigitos(telefone) || undefined,
      externalReference: guardianId,
      // A escola entrega a cobrança; cada aviso do provedor é cobrado.
      notificationDisabled: true,
    },
    chaveApi,
  );

  if (!criado.ok) {
    return { ok: false, motivo: `Não foi possível cadastrar ${nome}: ${criado.error}` };
  }

  return { ok: true, customerId: criado.id, nome, telefone };
}
