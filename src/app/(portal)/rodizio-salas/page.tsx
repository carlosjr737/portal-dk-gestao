import { PageHeader } from "@/components/layout/page-header";
import {
  getRoomRotationPageData,
  normalizeRoomRotationFilters,
} from "@/features/room-rotation/data";
import { RoomRotationPlanner } from "@/features/room-rotation/room-rotation-planner";
import { Alert } from "@/components/ui/alert";
import { getAuthenticatedUser, getCurrentEscolaId, getProfileByUserId } from "@/features/auth/session";
import { podeEditar } from "@/features/auth/permissions";
import { edicaoDaEscola, permissoesDaEscola } from "@/features/auth/permissoes-escola";

export const dynamic = "force-dynamic";

type RodizioSalasPageProps = {
  searchParams?: Promise<{
    year?: string;
    month?: string;
    dayGroup?: string;
    rotationLabel?: string;
    status?: string;
    planId?: string;
  }>;
};

export default async function RodizioSalasPage({
  searchParams,
}: RodizioSalasPageProps) {
  const params = await searchParams;
  const filters = normalizeRoomRotationFilters(params);
  const data = await getRoomRotationPageData(filters);

  const usuario = await getAuthenticatedUser();
  const perfil = usuario ? await getProfileByUserId(usuario.id) : null;
  const escolaId = perfil?.escolaId ?? (await getCurrentEscolaId());
  const [permissoes, edicao] = await Promise.all([
    permissoesDaEscola(escolaId),
    edicaoDaEscola(escolaId),
  ]);
  const somenteLeitura = perfil
    ? !podeEditar(perfil.role, "/rodizio-salas", permissoes, edicao)
    : true;

  return (
    <div>
      <PageHeader
        className="no-print"
        title="Rodízio de Salas"
        description="Monte visualmente a distribuição das turmas por sala e horário."
      />

      <div className="mt-6">
        {/*
        `fieldset disabled` desliga TODO controle de formulário de uma vez —
        mais confiável do que caçar cada botão dentro das 1113 linhas do
        planner, e imune a esquecer um quando alguém acrescentar outro.

        Nada disso é a permissão: ela está em `exigirEdicao`, no servidor.
        Isto existe para a tela não oferecer o que seria recusado.
      */}
      {somenteLeitura ? (
        <div className="space-y-4">
          <Alert tone="info">
            Você está vendo o rodízio em <strong>modo consulta</strong>. Dá para
            conferir sala e horário; remontar o mês é com a secretaria.
          </Alert>
          <fieldset disabled className="min-w-0 opacity-95">
            <RoomRotationPlanner data={data} filters={filters} somenteLeitura />
          </fieldset>
        </div>
      ) : (
        <RoomRotationPlanner data={data} filters={filters} />
      )}
      </div>
    </div>
  );
}
