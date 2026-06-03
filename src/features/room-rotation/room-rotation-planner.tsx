"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  copyPreviousRoomRotationPlan,
  createRoomRotationPlan,
  deleteRoomRotationAssignmentDrop,
  publishRoomRotationPlan,
  saveRoomRotationAssignmentDrop,
} from "@/features/room-rotation/actions";
import {
  formatRotationMonth,
  getRoomRotationDayGroupLabel,
  roomRotationDayGroupOptions,
  roomRotationLabels,
} from "@/features/room-rotation/constants";
import type {
  Room,
  RoomRotationAssignment,
  RoomRotationClassCard,
  RoomRotationConflict,
  RoomRotationDayGroup,
  RoomRotationPageData,
} from "@/features/room-rotation/types";

type PlannerFilters = {
  year: number;
  month: number;
  dayGroup: RoomRotationDayGroup;
  rotationLabel: string;
  status?: string;
};

type RoomRotationPlannerProps = {
  data: RoomRotationPageData;
  filters: PlannerFilters;
};

type DragPayload = {
  classId: string;
};

export function RoomRotationPlanner({
  data,
  filters,
}: RoomRotationPlannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draggedClassId, setDraggedClassId] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [assignments, setAssignments] = useState(data.assignments);
  const classById = useMemo(
    () => new Map(data.classes.map((danceClass) => [danceClass.id, danceClass])),
    [data.classes],
  );
  const assignmentsByClassId = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.class_id, assignment])),
    [assignments],
  );
  const sourcePlans = data.plans.filter(
    (plan) => plan.id !== data.selectedPlan?.id,
  );
  const availableClasses = data.classes.filter(
    (danceClass) => !assignmentsByClassId.has(danceClass.id),
  );

  async function saveDrop(classId: string, roomId: string, startTime: string) {
    if (!data.selectedPlan) {
      return;
    }

    const danceClass = classById.get(classId);
    const optimisticAssignment: RoomRotationAssignment = {
      id: assignmentsByClassId.get(classId)?.id ?? `pending-${classId}`,
      rotation_plan_id: data.selectedPlan.id,
      class_id: classId,
      room_id: roomId,
      start_time: startTime,
      end_time: danceClass?.primaryEndTime ?? null,
      day_group: filters.dayGroup,
      sort_order: 0,
      notes: null,
    };

    setAssignments((current) => [
      ...current.filter((assignment) => assignment.class_id !== classId),
      optimisticAssignment,
    ]);

    startTransition(async () => {
      const result = await saveRoomRotationAssignmentDrop({
        rotationPlanId: data.selectedPlan?.id ?? "",
        classId,
        roomId,
        startTime,
        endTime: danceClass?.primaryEndTime,
        dayGroup: filters.dayGroup,
      });

      if (result.status === "saved") {
        setAssignments((current) => [
          ...current.filter((assignment) => assignment.class_id !== classId),
          result.assignment as RoomRotationAssignment,
        ]);
      } else {
        router.refresh();
      }
    });
  }

  async function removeAssignment(assignmentId: string) {
    setAssignments((current) =>
      current.filter((assignment) => assignment.id !== assignmentId),
    );

    startTransition(async () => {
      const result = await deleteRoomRotationAssignmentDrop(assignmentId);

      if (result.status !== "deleted") {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="no-print rounded-lg border border-border bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Field label="Ano" name="year" type="number" value={filters.year} />
          <Select label="Mês" name="month" value={String(filters.month)}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={month} value={month}>
                {new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
                  new Date(filters.year, month - 1, 1),
                )}
              </option>
            ))}
          </Select>
          <Select label="Grupo de dias" name="dayGroup" value={filters.dayGroup}>
            {roomRotationDayGroupOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            label="Rodízio"
            name="rotationLabel"
            value={filters.rotationLabel}
          >
            {roomRotationLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </Select>
          <Select label="Status" name="status" value={filters.status ?? ""}>
            <option value="">Todos</option>
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
          </Select>
          <div className="flex items-end gap-2 xl:col-span-2">
            <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Filtrar
            </button>
            <a
              href="/rodizio-salas"
              className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium"
            >
              Limpar
            </a>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <PlanActionForm filters={filters} action={createRoomRotationPlan}>
            <button className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-white">
              Novo rodízio
            </button>
          </PlanActionForm>

          {data.selectedPlan ? (
            <>
              <button
                type="button"
                disabled
                className="h-10 rounded-md border border-border px-4 text-sm font-medium text-muted-foreground"
                title="As alterações são salvas automaticamente ao soltar o card."
              >
                Salvar
              </button>
              <PlanActionForm
                filters={filters}
                action={publishRoomRotationPlan}
                rotationPlanId={data.selectedPlan.id}
              >
                <button className="h-10 rounded-md border border-border px-4 text-sm font-medium">
                  Publicar
                </button>
              </PlanActionForm>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-10 rounded-md border border-border px-4 text-sm font-medium"
              >
                Imprimir
              </button>
              {sourcePlans.length > 0 ? (
                <form action={copyPreviousRoomRotationPlan} className="flex gap-2">
                  <HiddenFilters filters={filters} />
                  <input
                    type="hidden"
                    name="rotationPlanId"
                    value={data.selectedPlan.id}
                  />
                  <select
                    name="sourcePlanId"
                    className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                  >
                    {sourcePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.rotation_label} · {plan.status}
                      </option>
                    ))}
                  </select>
                  <button className="h-10 rounded-md border border-border px-4 text-sm font-medium">
                    Copiar rodízio
                  </button>
                </form>
              ) : null}
              <span className="inline-flex h-10 items-center rounded-md bg-muted px-3 text-sm font-medium">
                {data.selectedPlan.status === "published"
                  ? "Publicado"
                  : "Rascunho"}
              </span>
              {isPending ? (
                <span className="text-xs text-muted-foreground">Salvando...</span>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {!data.selectedPlan ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-800">
          Crie um novo rodízio para começar a montar as salas.
        </div>
      ) : null}

      <section className="grid gap-5 2xl:grid-cols-[360px_1fr]">
        <aside className="available-classes-panel no-print rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">Turmas disponíveis</h2>
            <p className="text-xs text-muted-foreground">
              Arraste uma turma para uma sala e horário.
            </p>
          </div>
          <div className="max-h-[760px] space-y-3 overflow-y-auto p-4">
            {availableClasses.length > 0 ? (
              availableClasses.map((danceClass) => (
                <AvailableClassCard
                  key={danceClass.id}
                  danceClass={danceClass}
                  draggable={Boolean(data.selectedPlan)}
                  onDragStart={() => setDraggedClassId(danceClass.id)}
                  onDragEnd={() => {
                    setDraggedClassId(null);
                    setActiveCell(null);
                  }}
                />
              ))
            ) : (
              <p className="rounded-md border border-border bg-muted px-3 py-4 text-sm text-muted-foreground">
                Nenhuma turma encontrada para os filtros selecionados.
              </p>
            )}
          </div>
        </aside>

        <div className="rotation-print-area overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {getRoomRotationDayGroupLabel(filters.dayGroup)}
            </p>
            <h2 className="text-xl font-bold text-foreground">
              {data.selectedPlan?.name ??
                `RODIZIO DE SALA ${filters.rotationLabel.replace("Rodízio ", "")} - ${formatRotationMonth(filters.year, filters.month).toUpperCase()}`}
            </h2>
          </div>

          {data.conflicts.length > 0 ? (
            <div className="no-print border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-800">
              <strong>Alertas:</strong>{" "}
              {data.conflicts.slice(0, 5).map((conflict) => conflict.message).join(" | ")}
              {data.conflicts.length > 5 ? " | ..." : ""}
            </div>
          ) : null}

          {data.rooms.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhuma sala cadastrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div
                className="rotation-board min-w-[980px]"
                style={{
                  gridTemplateColumns: `110px repeat(${data.rooms.length}, minmax(190px, 1fr))`,
                }}
              >
                <div className="room-header rotation-time-header">HORÁRIO</div>
                {data.rooms.map((room) => (
                  <div
                    key={room.id}
                    className="room-header"
                    style={{ backgroundColor: room.color ?? "#f8fafc" }}
                  >
                    {room.name}
                  </div>
                ))}

                {data.timeSlots.map((timeSlot) => (
                  <RotationRow
                    key={timeSlot}
                    rooms={data.rooms}
                    timeSlot={timeSlot}
                    assignments={assignments}
                    classById={classById}
                    conflicts={data.conflicts}
                    draggedClassId={draggedClassId}
                    activeCell={activeCell}
                    onActiveCellChange={setActiveCell}
                    onDrop={saveDrop}
                    onDragStart={setDraggedClassId}
                    onDragEnd={() => {
                      setDraggedClassId(null);
                      setActiveCell(null);
                    }}
                    onRemove={removeAssignment}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RotationRow({
  rooms,
  timeSlot,
  assignments,
  classById,
  conflicts,
  draggedClassId,
  activeCell,
  onActiveCellChange,
  onDrop,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  rooms: Room[];
  timeSlot: string;
  assignments: RoomRotationAssignment[];
  classById: Map<string, RoomRotationClassCard>;
  conflicts: RoomRotationConflict[];
  draggedClassId: string | null;
  activeCell: string | null;
  onActiveCellChange: (value: string | null) => void;
  onDrop: (classId: string, roomId: string, startTime: string) => void;
  onDragStart: (classId: string) => void;
  onDragEnd: () => void;
  onRemove: (assignmentId: string) => void;
}) {
  return (
    <>
      <div className="rotation-time-cell">{timeSlot}</div>
      {rooms.map((room) => {
        const cellKey = `${room.id}-${timeSlot}`;
        const cellAssignments = assignments.filter(
          (assignment) =>
            assignment.room_id === room.id &&
            assignment.start_time.slice(0, 5) === timeSlot,
        );
        const hasConflict = cellAssignments.some((assignment) =>
          conflicts.some(
            (conflict) =>
              conflict.assignmentId === assignment.id ||
              conflict.classId === assignment.class_id,
          ),
        );
        const hasTeacherConflict =
          draggedClassId &&
          cellAssignments.some((assignment) => {
            const dragged = classById.get(draggedClassId);
            const existing = classById.get(assignment.class_id);
            return dragged?.teacherName === existing?.teacherName;
          });

        return (
          <div
            key={cellKey}
            className={[
              "rotation-cell",
              activeCell === cellKey ? "is-over" : "",
              hasConflict || hasTeacherConflict ? "has-conflict" : "",
            ].join(" ")}
            onDragOver={(event) => {
              event.preventDefault();
              onActiveCellChange(cellKey);
            }}
            onDragLeave={() => onActiveCellChange(null)}
            onDrop={(event) => {
              event.preventDefault();
              const rawPayload = event.dataTransfer.getData("application/json");
              const payload = safeParseDragPayload(rawPayload);
              onActiveCellChange(null);
              if (payload?.classId) {
                onDrop(payload.classId, room.id, timeSlot);
              }
            }}
          >
            {cellAssignments.length === 0 ? (
              <div className="no-print flex h-full min-h-[62px] items-center justify-center rounded border border-dashed border-border text-[11px] text-muted-foreground">
                Solte aqui
              </div>
            ) : (
              <div className="space-y-2">
                {cellAssignments.map((assignment) => {
                  const danceClass = classById.get(assignment.class_id);
                  return danceClass ? (
                    <AssignedClassCard
                      key={assignment.id}
                      assignment={assignment}
                      danceClass={danceClass}
                      hasConflict={conflicts.some(
                        (conflict) =>
                          conflict.assignmentId === assignment.id ||
                          conflict.classId === danceClass.id,
                      )}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onRemove={onRemove}
                    />
                  ) : null;
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function AvailableClassCard({
  danceClass,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  danceClass: RoomRotationClassCard;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <article
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/json",
          JSON.stringify({ classId: danceClass.id } satisfies DragPayload),
        );
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-lg border border-border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:cursor-grabbing"
    >
      <ClassCardContent danceClass={danceClass} />
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
          {danceClass.activeStudentsCount} alunos
        </span>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          {danceClass.status}
        </span>
      </div>
      {!danceClass.hasAnySchedule ? (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Turma sem horário cadastrado.
        </p>
      ) : null}
    </article>
  );
}

function AssignedClassCard({
  assignment,
  danceClass,
  hasConflict,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  assignment: RoomRotationAssignment;
  danceClass: RoomRotationClassCard;
  hasConflict: boolean;
  onDragStart: (classId: string) => void;
  onDragEnd: () => void;
  onRemove: (assignmentId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/json",
          JSON.stringify({ classId: danceClass.id } satisfies DragPayload),
        );
        onDragStart(danceClass.id);
      }}
      onDragEnd={onDragEnd}
      className={`group rounded-md border p-2 shadow-sm ${
        hasConflict ? "border-amber-300 bg-amber-50" : "border-primary/20 bg-primary/5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <ClassCardContent danceClass={danceClass} compact />
        <button
          type="button"
          aria-label="Remover alocação"
          onClick={() => onRemove(assignment.id)}
          className="no-print rounded border border-border bg-white px-1.5 text-xs font-bold text-muted-foreground opacity-70 transition hover:text-red-600 group-hover:opacity-100"
        >
          x
        </button>
      </div>
      {hasConflict ? (
        <p className="no-print mt-1 text-[11px] font-medium text-amber-800">
          Alerta
        </p>
      ) : null}
    </div>
  );
}

function ClassCardContent({
  danceClass,
  compact = false,
}: {
  danceClass: RoomRotationClassCard;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div>
        <p className="text-xs font-bold uppercase text-foreground">
          {danceClass.teacherName}
        </p>
        <p className="text-xs font-semibold text-foreground">{danceClass.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {danceClass.activeStudentsCount} alunos
        </p>
        <p className="rotation-print-label mt-1 hidden text-xs font-semibold">
          {danceClass.teacherName.toUpperCase()} - {danceClass.name.toUpperCase()} (
          {danceClass.activeStudentsCount})
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-bold uppercase text-foreground">
        {danceClass.teacherName}
      </p>
      <p className="text-sm font-semibold text-foreground">
        {danceClass.levelName} · {danceClass.modalityName}
      </p>
      <p className="text-xs text-muted-foreground">{danceClass.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {danceClass.schedulesLabel}
      </p>
    </div>
  );
}

function safeParseDragPayload(rawPayload: string): DragPayload | null {
  try {
    const parsed = JSON.parse(rawPayload) as Partial<DragPayload>;
    return typeof parsed.classId === "string" ? { classId: parsed.classId } : null;
  } catch {
    return null;
  }
}

function PlanActionForm({
  filters,
  rotationPlanId,
  action,
  children,
}: {
  filters: PlannerFilters;
  rotationPlanId?: string;
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <HiddenFilters filters={filters} />
      {rotationPlanId ? (
        <input type="hidden" name="rotationPlanId" value={rotationPlanId} />
      ) : null}
      {children}
    </form>
  );
}

function HiddenFilters({ filters }: { filters: PlannerFilters }) {
  return (
    <>
      <input type="hidden" name="year" value={filters.year} />
      <input type="hidden" name="month" value={filters.month} />
      <input type="hidden" name="dayGroup" value={filters.dayGroup} />
      <input type="hidden" name="rotationLabel" value={filters.rotationLabel} />
      <input type="hidden" name="status" value={filters.status ?? ""} />
    </>
  );
}

function Field({
  label,
  name,
  type,
  value,
}: {
  label: string;
  name: string;
  type: string;
  value: string | number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
      />
    </label>
  );
}

function Select({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
      >
        {children}
      </select>
    </label>
  );
}
