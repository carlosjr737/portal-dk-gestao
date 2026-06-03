import { PageHeader } from "@/components/layout/page-header";
import {
  getRoomRotationPageData,
  normalizeRoomRotationFilters,
} from "@/features/room-rotation/data";
import { RoomRotationPlanner } from "@/features/room-rotation/room-rotation-planner";

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

  return (
    <div>
      <div className="no-print border-b border-border pb-6">
        <PageHeader
          title="Rodízio de Salas"
          description="Monte visualmente a distribuição das turmas por sala e horário."
        />
      </div>

      <div className="mt-6">
        <RoomRotationPlanner data={data} filters={filters} />
      </div>
    </div>
  );
}
