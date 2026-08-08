"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { enviarEmailSemBloquear } from "@/features/email/client";
import { emailAcessoCriado } from "@/features/email/templates";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformOwner } from "@/features/plataforma/auth";

export type NovaEscolaState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  /** Link para o admin da escola definir a senha. Enviado pelo operador. */
  linkAcesso?: string;
  emailAdmin?: string;
};

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da escola."),
  razao_social: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? v : null)),
  cnpj: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? v.replace(/\D/g, "") : null)),
  admin_nome: z.string().trim().min(1, "Informe o nome do responsável."),
  admin_email: z.string().trim().toLowerCase().email("E-mail inválido."),
});

/**
 * Cadastra uma escola e o primeiro admin dela, numa operação só.
 *
 * Criar só a escola não serve de nada: sem um usuário vinculado, ninguém
 * consegue entrar nela. E como o `escola_id` do perfil é o que a RLS usa
 * para tudo, ele precisa ser gravado no ato.
 */
export async function criarEscola(
  _prev: NovaEscolaState,
  formData: FormData,
): Promise<NovaEscolaState> {
  if (!(await isPlatformOwner())) {
    return { ok: false, message: "Apenas o operador da plataforma pode cadastrar escolas." };
  }

  const parsed = schema.safeParse({
    nome: String(formData.get("nome") ?? ""),
    razao_social: String(formData.get("razao_social") ?? ""),
    cnpj: String(formData.get("cnpj") ?? ""),
    admin_nome: String(formData.get("admin_nome") ?? ""),
    admin_email: String(formData.get("admin_email") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos.",
    };
  }

  const admin = createAdminClient();
  const { nome, razao_social, cnpj, admin_nome, admin_email } = parsed.data;

  // E-mail já usado? O perfil é único por usuário, então isso quebraria adiante.
  const { data: emailEmUso } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", admin_email)
    .maybeSingle();

  if (emailEmUso) {
    return {
      ok: false,
      errors: { admin_email: ["Este e-mail já está em uso no sistema."] },
      message: "Revise os campos.",
    };
  }

  // 1) Escola
  const { data: escola, error: escolaError } = await admin
    .from("school")
    .insert({ nome, razao_social, cnpj, status: "active", kyc_status: "pendente" })
    .select("id")
    .single();

  if (escolaError || !escola) {
    return {
      ok: false,
      message: `Não foi possível criar a escola: ${escolaError?.message ?? "erro desconhecido"}`,
    };
  }
  const escolaId = escola.id as string;

  // 2) Usuário admin. Senha aleatória descartável: quem define a senha real é
  //    a própria pessoa, pelo link abaixo. Assim ela nunca trafega por aqui.
  const senhaTemporaria = randomBytes(24).toString("base64url");
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: admin_email,
    password: senhaTemporaria,
    email_confirm: true,
    user_metadata: { name: admin_nome },
  });

  if (authError || !authData.user) {
    // Desfaz a escola para não deixar tenant órfão, sem ninguém que o acesse.
    await admin.from("school").delete().eq("id", escolaId);
    return {
      ok: false,
      message: `Não foi possível criar o usuário: ${authError?.message ?? "erro desconhecido"}`,
    };
  }

  // 3) Perfil vinculado à escola — é o escola_id daqui que alimenta toda a RLS.
  const { error: profileError } = await admin.from("profiles").insert({
    id: authData.user.id,
    name: admin_nome,
    email: admin_email,
    role: "admin",
    active: true,
    escola_id: escolaId,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    await admin.from("school").delete().eq("id", escolaId);
    return { ok: false, message: `Não foi possível criar o perfil: ${profileError.message}` };
  }

  // 4) Link para a pessoa definir a própria senha.
  let linkAcesso: string | undefined;
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: admin_email,
  });
  if (linkError) {
    console.error("Plataforma: falha ao gerar link de acesso", linkError);
  } else {
    linkAcesso = linkData.properties?.action_link;
  }

  /*
   * O link continua aparecendo na tela DE PROPÓSITO, mesmo com o e-mail
   * saindo. E-mail atrasa, cai em spam e às vezes o endereço tem um dígito
   * errado — e nesse dia quem cadastrou a escola precisa do link à mão para
   * mandar pelo WhatsApp. Tirar a cópia manual troca uma redundância barata
   * por um travamento no primeiro acesso do cliente.
   */
  if (linkAcesso) {
    enviarEmailSemBloquear(
      emailAcessoCriado({ para: admin_email, nomeEscola: nome, linkAcesso }),
    );
  }

  revalidatePath("/plataforma");

  return {
    ok: true,
    emailAdmin: admin_email,
    linkAcesso,
    message: linkAcesso
      ? `Escola "${nome}" criada. Envie o link abaixo para ${admin_email} definir a senha.`
      : `Escola "${nome}" criada, mas o link de acesso não pôde ser gerado. Use "Redefinir senha" na tela de usuários.`,
  };
}
