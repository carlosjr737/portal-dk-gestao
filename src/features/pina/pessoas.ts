import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Quem pode ter acesso ao Pina.
 *
 * ┌─ DOIS CADASTROS, UMA LISTA ─────────────────────────────────────────┐
 * │ O sistema guarda pessoas em dois lugares e nenhum sabe do outro:    │
 * │                                                                     │
 * │   staff_members  quem dá aula (tem turma, horário, remuneração)     │
 * │   profiles       quem entra no portal (tem login e papel)           │
 * │                                                                     │
 * │ Cadastrar em um NÃO cria no outro. A tela do Pina lia só            │
 * │ staff_members, então professora adicionada como usuária ficava       │
 * │ invisível — sem erro, sem aviso: a lista simplesmente não a tinha.  │
 * │ É o pior tipo de ausência, porque parece que o cadastro falhou.      │
 * │                                                                     │
 * │ Aqui os dois entram, unidos por E-MAIL, e cada linha diz de onde    │
 * │ veio. Quem aparece nos dois vira uma linha só, com o id do          │
 * │ professor — que é o que faz os dados do Pina baterem com as turmas. │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * A EQUIPE ENTRA JUNTO. Aux adm no Pina vira "master": enxerga os
 * espetáculos da escola inteira, não só os seus. É o papel que o
 * `resolvePinaViewer` já dava a admin/equipe — o que faltava era a pessoa
 * aparecer na lista para ser convidada.
 */

export type PessoaPina = {
  /** uid da conta no Pina: o do professor quando existe, senão o do perfil. */
  uid: string;
  nome: string;
  email: string | null;
  /** null quando a pessoa não tem ficha de professor. */
  staffMemberId: string | null;
  /** O que ela vai ser dentro do Pina. */
  papelNoPina: "professor" | "master";
  /** Aux adm enxerga tudo e não altera nada. Ver o contrato em docs/. */
  somenteLeitura: boolean;
  /** Para a tela poder explicar por que alguém está aqui. */
  origem: "professor" | "usuario" | "ambos";
  /** Sem ficha de professor não há turma — e sem turma o Pina abre vazio. */
  semTurmas: boolean;
};

const chave = (email: string | null) => (email ?? "").trim().toLowerCase();

export async function listarPessoasPina(escolaId: string | null): Promise<PessoaPina[]> {
  if (!escolaId) return [];

  const admin = createAdminClient();
  const [{ data: staff }, { data: perfis }] = await Promise.all([
    admin
      .from("staff_members")
      .select("id, full_name, artistic_name, email")
      .eq("escola_id", escolaId)
      .eq("role", "professor")
      .eq("status", "active")
      .order("full_name"),
    admin
      .from("profiles")
      .select("id, name, email, role")
      .eq("escola_id", escolaId)
      .eq("active", true)
      .in("role", ["admin", "equipe", "professor"]),
  ]);

  const porEmail = new Map<string, PessoaPina>();
  const semEmail: PessoaPina[] = [];

  for (const s of staff ?? []) {
    const email = (s.email as string | null) ?? null;
    const pessoa: PessoaPina = {
      uid: s.id as string,
      nome:
        ((s.artistic_name as string | null)?.trim() || (s.full_name as string | null)) ??
        "Sem nome",
      email,
      staffMemberId: s.id as string,
      papelNoPina: "professor",
      somenteLeitura: false,
      origem: "professor",
      semTurmas: false,
    };
    /*
     * Sem e-mail não dá para juntar com perfil nenhum nem provisionar conta.
     * Fica numa lista à parte para APARECER na tela desabilitada — some daqui
     * e a escola nunca descobre que falta o e-mail dessa pessoa.
     */
    if (!email) semEmail.push(pessoa);
    else porEmail.set(chave(email), pessoa);
  }

  for (const p of perfis ?? []) {
    const email = (p.email as string | null) ?? null;
    const k = chave(email);
    const ehMaster = ["admin", "equipe"].includes(p.role as string);
    // Só o aux adm é leitor. A direção continua podendo mexer.
    const soLeitura = (p.role as string) === "equipe";
    const existente = k ? porEmail.get(k) : undefined;

    if (existente) {
      // Já tem ficha de professor: mantém o uid do professor e só apura o papel.
      existente.origem = "ambos";
      if (ehMaster) existente.papelNoPina = "master";
      if (soLeitura) existente.somenteLeitura = true;
      continue;
    }
    if (!email) continue;

    porEmail.set(k, {
      uid: p.id as string,
      nome: ((p.name as string | null)?.trim() || email) ?? "Sem nome",
      email,
      staffMemberId: null,
      papelNoPina: ehMaster ? "master" : "professor",
      somenteLeitura: soLeitura,
      origem: "usuario",
      /*
       * Perfil sem ficha de professor não tem turma vinculada. Para quem é
       * master isso não importa — enxerga a escola toda. Para quem entra como
       * professor, importa muito: o Pina abre sem nada, e ela vai achar que o
       * acesso quebrou.
       */
      semTurmas: !ehMaster,
    });
  }

  return [...porEmail.values(), ...semEmail].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
