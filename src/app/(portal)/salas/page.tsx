import { PageHeader } from "@/components/layout/page-header";
import {
  createRoom,
  deleteRoom,
  toggleRoomActive,
  updateRoom,
} from "@/features/rooms/actions";
import { RoomForm } from "@/features/rooms/room-form";
import type { RoomRecord } from "@/features/rooms/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SalasPage() {
  const { rooms, errorMessage } = await getRooms();

  return (
    <div>
      <PageHeader
        title="Salas"
        description="Cadastre e organize as salas usadas nas aulas e nos rodízios."
      />

      {errorMessage ? (
        <section className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">Tabela de salas não encontrada.</p>
          <p className="mt-1">{errorMessage}</p>
          <p className="mt-2">
            Rode a migration `028_ensure_room_rotation_default_rooms.sql` ou o
            SQL informado no relatório final.
          </p>
        </section>
      ) : null}

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Nova sala
            </h2>
            <p className="text-sm text-muted-foreground">
              O slug é gerado automaticamente pelo nome, mas pode ser editado.
            </p>
          </div>
        </div>
        <RoomForm action={createRoom} submitLabel="Cadastrar sala" />
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            Salas cadastradas
          </h2>
        </div>

        <div className="divide-y divide-border">
          {rooms.length > 0 ? (
            rooms.map((room) => {
              const updateRoomWithId = updateRoom.bind(null, room.id);

              return (
                <details key={room.id} className="group">
                  <summary className="grid cursor-pointer gap-3 px-5 py-4 text-sm marker:hidden md:grid-cols-[1.1fr_1fr_0.7fr_0.6fr_0.8fr_auto] md:items-center">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-6 w-6 rounded border border-border"
                        style={{ backgroundColor: room.color ?? "#f8fafc" }}
                      />
                      <div>
                        <p className="font-medium text-foreground">{room.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {room.active ? "Ativa" : "Inativa"}
                        </p>
                      </div>
                    </div>
                    <span className="text-muted-foreground">{room.slug}</span>
                    <span className="text-muted-foreground">
                      {room.capacity ? `${room.capacity} pessoas` : "Sem capacidade"}
                    </span>
                    <span className="text-muted-foreground">
                      Ordem {room.sort_order}
                    </span>
                    <RoomQuickActions room={room} />
                    <span className="text-sm font-medium text-primary group-open:hidden">
                      Editar
                    </span>
                  </summary>
                  <div className="bg-muted/40 px-5 pb-5">
                    <RoomForm
                      action={updateRoomWithId}
                      defaultValues={room}
                      submitLabel="Salvar alterações"
                      compact
                    />
                  </div>
                </details>
              );
            })
          ) : (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhuma sala cadastrada.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RoomQuickActions({ room }: { room: RoomRecord }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={toggleRoomActive}>
        <input type="hidden" name="roomId" value={room.id} />
        <input type="hidden" name="active" value={String(!room.active)} />
        <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium">
          {room.active ? "Desativar" : "Ativar"}
        </button>
      </form>
      <form action={deleteRoom}>
        <input type="hidden" name="roomId" value={room.id} />
        <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-red-600">
          Excluir
        </button>
      </form>
    </div>
  );
}

async function getRooms(): Promise<{
  rooms: RoomRecord[];
  errorMessage?: string;
}> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, slug, capacity, color, sort_order, active, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("[ROOMS] list load error", error);
      return {
        rooms: [],
        errorMessage:
          error.code === "PGRST205"
            ? "A tabela public.rooms não existe no Supabase remoto."
            : error.message,
      };
    }

    return {
      rooms: (data ?? []) as RoomRecord[],
    };
  } catch (error) {
    console.error("[ROOMS] list load error", error);
    return {
      rooms: [],
      errorMessage: error instanceof Error ? error.message : "Erro ao carregar salas.",
    };
  }
}
