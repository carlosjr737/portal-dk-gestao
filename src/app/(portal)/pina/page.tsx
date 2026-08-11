import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { getAuthenticatedUser } from "@/features/auth/session";
import { resolvePinaViewer } from "@/features/pina/auth";
import { PINA_APP_URL } from "@/features/pina/config";
import { AbrirPina } from "@/features/pina/abrir-pina";

export const dynamic = "force-dynamic";

/**
 * A porta do Pina dentro do portal.
 *
 * Antes o único botão "Abrir no Pina" vivia dentro da página de um
 * espetáculo — tela que o professor nem enxerga. Na prática, a integração
 * existia inteira e não tinha por onde ser usada por quem mais precisa dela.
 *
 * Esta página não repete o Pina: ela explica em duas linhas o que é e abre.
 * Quem entra aqui já tem sessão no portal e não faz segundo login.
 */
export default async function PinaPage() {
  const user = await getAuthenticatedUser();
  const viewer = user ? await resolvePinaViewer(user.id) : null;

  return (
    <div>
      <PageHeader
        title="Pina"
        description="O app de formações e coreografias, ligado ao seu cadastro daqui."
      />

      {!viewer ? (
        <Alert tone="warning" className="mt-6">
          <p className="font-medium">Seu acesso ao Pina ainda não está liberado.</p>
          <p className="mt-1">
            Peça para a secretaria abrir <strong>Configurações → Acessos ao Pina</strong>{" "}
            e liberar o seu. Leva menos de um minuto.
          </p>
        </Alert>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="overflow-hidden rounded-lg border border-primary/30 bg-primary/5 p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Suas coreografias e formações
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              No Pina você monta as formações do palco arrastando os alunos,
              guarda cada coreografia por música e acompanha o espetáculo ao
              vivo no dia. O que você marca lá aparece aqui, e vice-versa.
            </p>

            <div className="mt-5">
              {/*
                Sem senha nova: o botão troca a sessão do portal por um token
                do Pina. Pedir um segundo login seria pedir para a pessoa
                inventar mais uma senha — e depois esquecê-la.
              */}
              <AbrirPina pinaUrl={PINA_APP_URL} />
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Abre em outra aba. Você não precisa de senha: entra com este mesmo
              acesso.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
