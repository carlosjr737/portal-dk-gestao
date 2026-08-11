import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { getAuthenticatedUser, getCurrentEscolaId, getProfileByUserId } from "@/features/auth/session";
import { CATEGORIAS, navigationItems } from "@/features/auth/permissions";
import { papelConfigurado, permissoesDaEscola } from "@/features/auth/permissoes-escola";
import { PainelPermissoes } from "@/features/permissoes/painel";

export const dynamic = "force-dynamic";

const PAPEIS = [
  {
    chave: "admin",
    nome: "Direção",
    descricao: "Acesso total ao sistema, incluindo financeiro e configurações.",
    editavel: false,
  },
  {
    chave: "equipe",
    nome: "Auxiliar administrativo",
    descricao:
      "O dia a dia da secretaria: alunos, matrículas, turmas e a cobrança.",
    editavel: true,
  },
  {
    chave: "professor",
    nome: "Professor",
    descricao: "As telas da aula. Não enxerga dado financeiro nem cadastro.",
    editavel: true,
  },
];

export default async function PermissoesPage() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;

  /*
   * O layout já barra quem não tem a rota, mas esta checagem fica aqui de
   * qualquer jeito: é a tela que decide o alcance de todo mundo, e depender de
   * uma única camada para protegê-la é apostar que ninguém vai mexer no menu.
   */
  if (profile?.role !== "admin") redirect("/acesso-nao-autorizado");

  const escolaId = await getCurrentEscolaId();
  const permissoes = await permissoesDaEscola(escolaId);
  const [equipeConfig, professorConfig] = await Promise.all([
    papelConfigurado(escolaId, "equipe"),
    papelConfigurado(escolaId, "professor"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissões"
        description="O que cada função enxerga no sistema."
      />

      <Alert tone="info">
        Desmarcar uma tela some com ela do menu <strong>e</strong> fecha o
        endereço. Quem tentar abrir pela URL leva “acesso negado” — esconder do
        menu, sozinho, não protegeria nada.
      </Alert>

      <PainelPermissoes
        papeis={PAPEIS}
        categorias={[...CATEGORIAS]}
        itens={navigationItems.map((i) => ({
          href: i.href,
          label: i.label,
          categoria: i.categoria,
        }))}
        permitidasPorPapel={{
          equipe: permissoes.equipe,
          professor: permissoes.professor,
        }}
        configurados={{ equipe: equipeConfig, professor: professorConfig }}
      />
    </div>
  );
}
