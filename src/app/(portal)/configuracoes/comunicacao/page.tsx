import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentEscolaId } from "@/features/auth/session";
import { CATALOGO, GRUPOS } from "@/features/email/catalogo";
import { textoEmVigor } from "@/features/email/render";
import { moldura } from "@/features/email/templates";
import { PainelComunicacao } from "@/features/comunicacao/painel";

export const dynamic = "force-dynamic";

/** Marcador que o cliente troca pelo corpo, para a prévia usar a moldura real. */
const MARCA = "<!--CORPO-->";

export default async function ComunicacaoPage() {
  const escolaId = await getCurrentEscolaId();

  const textos = await Promise.all(
    CATALOGO.map(async (d) => {
      const t = await textoEmVigor(d.chave, escolaId);
      return { chave: d.chave, ...t };
    }),
  );

  // Quem editou o quê, por último. Uma consulta só para os seis.
  const admin = createAdminClient();
  const { data: historico } = escolaId
    ? await admin
        .from("email_template_historico")
        .select("chave, acao, autor_email, criado_em")
        .eq("escola_id", escolaId)
        .order("criado_em", { ascending: false })
        .limit(60)
    : { data: [] };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comunicação"
        description="Os e-mails que o sistema manda sozinho. Aqui você ajusta o texto."
      />

      {/*
        O aviso existe para ninguém procurar um botão de ligar e desligar que
        não existe. Sem ele, a primeira pergunta de todo mundo é "como faço
        para parar de mandar?".
      */}
      <Alert tone="info">
        Estes e-mails saem automaticamente quando o evento acontece. Você muda o
        texto — <strong>quando eles saem não é configurável</strong>.
      </Alert>

      <PainelComunicacao
        grupos={GRUPOS}
        catalogo={CATALOGO.map((d) => ({
          chave: d.chave,
          grupo: d.grupo,
          nome: d.nome,
          quandoSai: d.quandoSai,
          variaveis: d.variaveis,
          obrigatorias: d.obrigatorias,
          botao: d.botao,
        }))}
        textos={textos}
        historico={(historico ?? []) as Array<{
          chave: string;
          acao: string;
          autor_email: string | null;
          criado_em: string;
        }>}
        molduraHtml={moldura(MARCA, "")}
        marcador={MARCA}
      />
    </div>
  );
}
