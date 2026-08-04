/**
 * Validação de CPF e CNPJ.
 *
 * POR QUE ISTO EXISTE. O campo `document` é texto livre — o schema o descreve
 * como "CPF/RG ou outro documento", e é comum entrar RG no cadastro. Só que o
 * Asaas exige CPF ou CNPJ para emitir cobrança, e quando o valor não presta
 * ele responde "O CPF/CNPJ informado é inválido".
 *
 * Sem esta checagem, esse erro aparecia no pior momento possível: ao clicar em
 * "Gerar cobrança", meses depois do cadastro, numa mensagem do provedor que
 * não diz de quem é o documento nem onde arrumar. Validar aqui move a
 * descoberta para antes da chamada e deixa a mensagem ser nossa.
 *
 * Só o dígito verificador. Não diz se o CPF existe na Receita nem de quem é —
 * para isso seria preciso consultar a Receita, e o que se quer aqui é apenas
 * não mandar lixo para o provedor.
 */

export function apenasDigitos(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "");
}

/** Dígito verificador pelo módulo 11, com a regra "resto < 2 ⇒ 0". */
function digitoModulo11(digitos: string, pesos: number[]): number {
  const soma = pesos.reduce((acc, peso, i) => acc + Number(digitos[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(valor: unknown): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 11) return false;
  // 111.111.111-11 e afins passam no cálculo, mas não são CPF de ninguém.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const dv1 = digitoModulo11(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = digitoModulo11(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === Number(d[9]) && dv2 === Number(d[10]);
}

export function cnpjValido(valor: unknown): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const dv1 = digitoModulo11(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = digitoModulo11(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}

export function cpfOuCnpjValido(valor: unknown): boolean {
  return cpfValido(valor) || cnpjValido(valor);
}

/**
 * Por que este documento não serve para cobrança, em português.
 *
 * Devolve `null` quando serve. A distinção entre "vazio", "não é CPF nem CNPJ"
 * e "dígito verificador não fecha" importa: são três consertos diferentes, e
 * uma mensagem única mandaria a secretaria adivinhar qual é o caso.
 */
export function motivoDocumentoInvalido(valor: unknown): string | null {
  const d = apenasDigitos(valor);
  if (d.length === 0) return "está sem CPF/CNPJ";
  if (d.length !== 11 && d.length !== 14) {
    return `tem ${d.length} dígito${d.length === 1 ? "" : "s"} no documento — CPF tem 11 e CNPJ tem 14 (RG não serve para cobrança)`;
  }
  if (!cpfOuCnpjValido(d)) {
    return `tem um ${d.length === 11 ? "CPF" : "CNPJ"} que não confere — verifique se algum dígito está trocado`;
  }
  return null;
}
