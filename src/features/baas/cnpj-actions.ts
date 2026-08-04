"use server";

import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";

/**
 * Consulta de CNPJ para preencher o cadastro sozinho.
 *
 * A pessoa digita o CNPJ e confere o resto, em vez de redigitar razão social e
 * endereço que já existem numa base pública. Menos digitação é menos erro — e
 * erro de endereço aqui não é cosmético: o Asaas identifica a cidade pelo CEP,
 * então um dígito errado contamina o cadastro inteiro da conta de pagamentos.
 *
 * Roda no servidor, não no navegador: a BrasilAPI não manda CORS liberado, e
 * de qualquer forma chamada externa a partir da tela do cliente é mais uma
 * coisa que quebra por bloqueador de anúncio.
 *
 * Falha aqui NUNCA trava o fluxo. A busca é conveniência; se a base estiver
 * fora do ar, a pessoa preenche à mão como sempre fez.
 */

export type ConsultaCnpj =
  | {
      ok: true;
      razaoSocial: string;
      email: string | null;
      telefone: string | null;
      cep: string | null;
      logradouro: string | null;
      numero: string | null;
      complemento: string | null;
      bairro: string | null;
      /** MEI vem marcado na Receita; o resto é palpite e fica de fora. */
      companyType: "MEI" | null;
    }
  | { ok: false; message: string };

export async function consultarCnpj(cnpj: string): Promise<ConsultaCnpj> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Sem permissão." };
  }

  const digitos = cnpj.replace(/\D/g, "");
  if (digitos.length !== 14) {
    return { ok: false, message: "CNPJ precisa ter 14 dígitos." };
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`, {
      // A base muda pouco e a mesma escola costuma repetir a consulta enquanto
      // corrige outro campo. Um dia de cache evita bater na API a cada tecla
      // corrigida sem servir dado velho o bastante para importar.
      next: { revalidate: 86_400 },
    });

    if (res.status === 404) {
      return { ok: false, message: "CNPJ não encontrado na Receita." };
    }
    if (!res.ok) {
      return { ok: false, message: "Não deu para consultar agora. Preencha à mão." };
    }

    const d = (await res.json()) as Record<string, unknown>;
    const texto = (v: unknown) => {
      const s = String(v ?? "").trim();
      return s.length > 0 ? s : null;
    };

    return {
      ok: true,
      razaoSocial: String(d.razao_social ?? d.nome_fantasia ?? "").trim(),
      email: texto(d.email),
      telefone: texto(d.ddd_telefone_1),
      cep: texto(d.cep),
      logradouro:
        [texto(d.descricao_tipo_de_logradouro), texto(d.logradouro)]
          .filter(Boolean)
          .join(" ") || null,
      numero: texto(d.numero),
      complemento: texto(d.complemento),
      bairro: texto(d.bairro),
      /*
       * Só o MEI é afirmado. LTDA, associação e individual dependem da
       * natureza jurídica, e errar o tipo faz o Asaas recusar a conta — um
       * palpite aqui custa mais que o campo em branco.
       */
      companyType: d.opcao_pelo_mei === true ? "MEI" : null,
    };
  } catch {
    return { ok: false, message: "Não deu para consultar agora. Preencha à mão." };
  }
}
