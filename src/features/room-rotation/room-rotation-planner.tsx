"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  RoomRotationDayGroup,
  RoomRotationPageData,
} from "@/features/room-rotation/types";

const slotHeight = 34;
const minBlockHeight = 28;

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

type Notice = {
  tone: "success" | "warning" | "error";
  message: string;
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const dropHandledRef = useRef(false);
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

  useEffect(() => {
    setAssignments(data.assignments);
  }, [data.assignments]);

  function handleDragStart(classId: string) {
    dropHandledRef.current = false;
    setDraggedClassId(classId);
    console.log("[ROOM ROTATION DND] drag start", {
      event: "native-dragstart",
      activeId: `class:${classId}`,
      classId,
    });
  }

  function handleDragEnd() {
    console.log("[ROOM ROTATION DND] drag end", {
      activeId: draggedClassId ? `class:${draggedClassId}` : null,
      overId: activeCell ? `slot:${activeCell}` : null,
    });

    if (!dropHandledRef.current) {
      console.log("[ROOM ROTATION DND] no drop target", {
        classId: draggedClassId,
      });
    }

    setDraggedClassId(null);
    setActiveCell(null);
  }

  async function saveDrop(classId: string, roomId: string, startTime: string) {
    dropHandledRef.current = true;
    console.log("[ROOM ROTATION DND] dropped", {
      activeId: `class:${classId}`,
      overId: `slot:${roomId}:${startTime}`,
      classId,
      roomId,
      startTime,
    });

    if (!data.selectedPlan) {
      setNotice({
        tone: "warning",
        message: "Crie um rodízio antes de alocar turmas.",
      });
      return;
    }

    const targetRoom = data.rooms.find((room) => room.id === roomId);

    if (!targetRoom || targetRoom.isFallback || !isUuid(roomId)) {
      setNotice({
        tone: "error",
        message:
          "Salas padrão não foram encontradas no banco. Rode o SQL de criação das salas.",
      });
      return;
    }

    const danceClass = classById.get(classId);
    const durationMinutes = getClassDurationMinutes(danceClass);

    if (!danceClass || durationMinutes <= 0) {
      setNotice({
        tone: "error",
        message: "Turma sem horário válido. Cadastre início e fim antes de alocar.",
      });
      return;
    }

    const endTime = minutesToTime(timeToMinutes(startTime) + durationMinutes);
    const currentAssignment = assignmentsByClassId.get(classId);
    const hasRoomOverlap = assignments.some((assignment) => {
      if (
        assignment.room_id !== roomId ||
        assignment.class_id === classId ||
        assignment.id === currentAssignment?.id
      ) {
        return false;
      }

      return intervalsOverlap(
        startTime,
        endTime,
        assignment.start_time.slice(0, 5),
        assignment.end_time?.slice(0, 5) ?? addMinutes(assignment.start_time, 30),
      );
    });

    if (hasRoomOverlap) {
      setNotice({
        tone: "error",
        message: "Já existe uma turma nessa sala durante este horário.",
      });
      return;
    }

    const hasTeacherOverlap = assignments.some((assignment) => {
      if (assignment.class_id === classId) {
        return false;
      }

      const assignedClass = classById.get(assignment.class_id);

      return (
        assignedClass?.teacherName === danceClass.teacherName &&
        intervalsOverlap(
          startTime,
          endTime,
          assignment.start_time.slice(0, 5),
          assignment.end_time?.slice(0, 5) ?? addMinutes(assignment.start_time, 30),
        )
      );
    });

    const optimisticAssignment: RoomRotationAssignment = {
      id: currentAssignment?.id ?? `pending-${classId}`,
      rotation_plan_id: data.selectedPlan.id,
      class_id: classId,
      room_id: roomId,
      start_time: startTime,
      end_time: endTime,
      day_group: filters.dayGroup,
      sort_order: 0,
      notes: null,
    };

    setAssignments((current) => [
      ...current.filter((assignment) => assignment.class_id !== classId),
      optimisticAssignment,
    ]);
    setNotice({
      tone: hasTeacherOverlap ? "warning" : "success",
      message: hasTeacherOverlap
        ? "Alocação salva com alerta: professor em outro horário sobreposto."
        : "Alocação salva.",
    });

    startTransition(async () => {
      const result = await saveRoomRotationAssignmentDrop({
        rotationPlanId: data.selectedPlan?.id ?? "",
        classId,
        roomId,
        startTime,
        endTime,
        dayGroup: filters.dayGroup,
      });

      if (result.status === "saved") {
        console.log("[ROOM ROTATION DND] save success", {
          classId,
          roomId,
          startTime,
        });
        setAssignments((current) => [
          ...current.filter((assignment) => assignment.class_id !== classId),
          result.assignment as RoomRotationAssignment,
        ]);
      } else {
        console.log("[ROOM ROTATION DND] save failed", {
          classId,
          roomId,
          startTime,
          message: result.message,
        });
        setNotice({
          tone: "error",
          message: result.message,
        });
        router.refresh();
      }
    });
  }

  async function removeAssignment(assignmentId: string) {
    setAssignments((current) =>
      current.filter((assignment) => assignment.id !== assignmentId),
    );
    setNotice({ tone: "success", message: "Alocação removida." });

    startTransition(async () => {
      const result = await deleteRoomRotationAssignmentDrop(assignmentId);

      if (result.status !== "deleted") {
        setNotice({
          tone: "error",
          message: result.message,
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
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
          <Select label="Rodízio" name="rotationLabel" value={filters.rotationLabel}>
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
                className="h-10 rounded-md border border-border px-4 text-sm font-medium"
                onClick={() =>
                  setNotice({
                    tone: "success",
                    message: "As alterações são salvas automaticamente ao soltar o card.",
                  })
                }
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

      {notice ? (
        <div
          className={`no-print rounded-md border px-4 py-3 text-sm ${
            notice.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : notice.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      {!data.selectedPlan ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
          Crie um novo rodízio para começar a montar as salas.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="available-classes-panel no-print rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Turmas disponíveis</h2>
              <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                {availableClasses.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Arraste para uma sala e horário.
            </p>
          </div>
          <div className="max-h-[calc(100vh-300px)] min-h-[360px] space-y-2 overflow-y-auto p-3">
            {availableClasses.length > 0 ? (
              availableClasses.map((danceClass) => (
                <AvailableClassCard
                  key={danceClass.id}
                  danceClass={danceClass}
                  draggable={Boolean(data.selectedPlan)}
                  onDragStart={() => handleDragStart(danceClass.id)}
                  onDragEnd={handleDragEnd}
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
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {getRoomRotationDayGroupLabel(filters.dayGroup)}
            </p>
            <h2 className="text-lg font-bold text-foreground">
              {data.selectedPlan?.name ??
                `RODIZIO DE SALA ${filters.rotationLabel.replace("Rodízio ", "")} - ${formatRotationMonth(filters.year, filters.month).toUpperCase()}`}
            </h2>
            <p className="no-print mt-1 text-xs text-muted-foreground">
              Salas carregadas do cadastro em Turmas e Aulas &gt; Salas.
            </p>
          </div>

          <div className="no-print border-b border-border bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
            Cada linha representa 30 minutos. O bloco da turma cresce conforme a duração da aula.
          </div>

          <RotationScheduleBoard
            rooms={data.rooms}
            timeSlots={data.timeSlots}
            assignments={assignments}
            classById={classById}
            draggedClassId={draggedClassId}
            activeCell={activeCell}
            selectedPlanExists={Boolean(data.selectedPlan)}
            onActiveCellChange={setActiveCell}
            onDrop={saveDrop}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onRemove={removeAssignment}
          />
        </div>
      </section>
    </div>
  );
}

function RotationScheduleBoard({
  rooms,
  timeSlots,
  assignments,
  classById,
  draggedClassId,
  activeCell,
  selectedPlanExists,
  onActiveCellChange,
  onDrop,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  rooms: Room[];
  timeSlots: string[];
  assignments: RoomRotationAssignment[];
  classById: Map<string, RoomRotationClassCard>;
  draggedClassId: string | null;
  activeCell: string | null;
  selectedPlanExists: boolean;
  onActiveCellChange: (value: string | null) => void;
  onDrop: (classId: string, roomId: string, startTime: string) => void;
  onDragStart: (classId: string) => void;
  onDragEnd: () => void;
  onRemove: (assignmentId: string) => void;
}) {
  if (rooms.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Nenhuma sala cadastrada.</p>
        <p className="mt-1">
          Cadastre as salas em Turmas e Aulas &gt; Salas para montar o rodízio.
        </p>
        <a
          href="/salas"
          className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Cadastrar salas
        </a>
      </div>
    );
  }

  const scheduleHeight = timeSlots.length * slotHeight;

  return (
    <div className="overflow-x-auto">
      <div
        className={`rotation-scheduler min-w-[980px] ${
          selectedPlanExists ? "" : "is-disabled"
        }`}
        style={{
          gridTemplateColumns: `86px repeat(${rooms.length}, minmax(170px, 1fr))`,
        }}
      >
        <div className="rotation-room-header rotation-hour-header">HORÁRIO</div>
        {rooms.map((room) => (
          <div
            key={room.id}
            className="rotation-room-header"
            style={{ backgroundColor: room.color ?? "#f8fafc" }}
          >
            {room.name.toUpperCase()}
          </div>
        ))}

        <div className="rotation-time-rail" style={{ height: scheduleHeight }}>
          {timeSlots.map((timeSlot) => (
            <div key={timeSlot} className="rotation-time-slot">
              {timeSlot.endsWith(":00") ? timeSlot : ""}
            </div>
          ))}
        </div>

        {rooms.map((room) => (
          <RoomScheduleColumn
            key={room.id}
            room={room}
            timeSlots={timeSlots}
            height={scheduleHeight}
            assignments={assignments.filter(
              (assignment) => assignment.room_id === room.id,
            )}
            allAssignments={assignments}
            classById={classById}
            draggedClassId={draggedClassId}
            activeCell={activeCell}
            selectedPlanExists={selectedPlanExists}
            onActiveCellChange={onActiveCellChange}
            onDrop={onDrop}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onRemove={onRemove}
          />
        ))}
        {!selectedPlanExists ? (
          <div className="rotation-board-disabled no-print">
            <p className="font-semibold text-foreground">
              Crie um rodízio antes de alocar turmas.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use o botão Novo rodízio para liberar o arrastar e soltar.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RoomScheduleColumn({
  room,
  timeSlots,
  height,
  assignments,
  allAssignments,
  classById,
  draggedClassId,
  activeCell,
  selectedPlanExists,
  onActiveCellChange,
  onDrop,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  room: Room;
  timeSlots: string[];
  height: number;
  assignments: RoomRotationAssignment[];
  allAssignments: RoomRotationAssignment[];
  classById: Map<string, RoomRotationClassCard>;
  draggedClassId: string | null;
  activeCell: string | null;
  selectedPlanExists: boolean;
  onActiveCellChange: (value: string | null) => void;
  onDrop: (classId: string, roomId: string, startTime: string) => void;
  onDragStart: (classId: string) => void;
  onDragEnd: () => void;
  onRemove: (assignmentId: string) => void;
}) {
  return (
    <div className="rotation-room-column" style={{ height }}>
      {timeSlots.map((timeSlot) => {
        const cellKey = `${room.id}-${timeSlot}`;
        const draggedClass = draggedClassId ? classById.get(draggedClassId) : null;
        const draggedDuration = getClassDurationMinutes(draggedClass);
        const dropEnd = draggedDuration > 0
          ? minutesToTime(timeToMinutes(timeSlot) + draggedDuration)
          : addMinutes(timeSlot, 30);
        const hasRoomOverlap = draggedClassId
          ? assignments.some(
              (assignment) =>
                assignment.class_id !== draggedClassId &&
                intervalsOverlap(
                  timeSlot,
                  dropEnd,
                  assignment.start_time.slice(0, 5),
                  assignment.end_time?.slice(0, 5) ??
                    addMinutes(assignment.start_time, 30),
                ),
            )
          : false;
        const hasTeacherOverlap = draggedClassId
          ? allAssignments.some((assignment) => {
              if (assignment.class_id === draggedClassId) {
                return false;
              }

              const assignedClass = classById.get(assignment.class_id);

              return (
                assignedClass?.teacherName === draggedClass?.teacherName &&
                intervalsOverlap(
                  timeSlot,
                  dropEnd,
                  assignment.start_time.slice(0, 5),
                  assignment.end_time?.slice(0, 5) ??
                    addMinutes(assignment.start_time, 30),
                )
              );
            })
          : false;

        return (
          <div
            key={cellKey}
            className={[
              "rotation-slot",
              activeCell === cellKey ? "is-over" : "",
              hasRoomOverlap ? "is-blocked" : "",
              hasTeacherOverlap && !hasRoomOverlap ? "has-warning" : "",
            ].join(" ")}
            onDragOver={(event) => {
              if (!selectedPlanExists) {
                return;
              }

              event.preventDefault();
              onActiveCellChange(cellKey);
            }}
            onDragLeave={() => onActiveCellChange(null)}
            onDrop={(event) => {
              event.preventDefault();
              const rawPayload =
                event.dataTransfer.getData("application/json") ||
                event.dataTransfer.getData("text/plain");
              const payload = safeParseDragPayload(rawPayload);
              onActiveCellChange(null);

              if (payload?.classId) {
                onDrop(payload.classId, room.id, timeSlot);
              }
            }}
          />
        );
      })}

      {assignments.map((assignment) => {
        const danceClass = classById.get(assignment.class_id);

        if (!danceClass) {
          return null;
        }

        const top = getSlotOffset(timeSlots, assignment.start_time);
        const heightInPixels = getAssignmentHeight(assignment, danceClass);
        const hasTeacherConflict = allAssignments.some((candidate) => {
          if (candidate.id === assignment.id || candidate.class_id === assignment.class_id) {
            return false;
          }

          const candidateClass = classById.get(candidate.class_id);

          return (
            candidateClass?.teacherName === danceClass.teacherName &&
            intervalsOverlap(
              assignment.start_time.slice(0, 5),
              assignment.end_time?.slice(0, 5) ??
                addMinutes(assignment.start_time, 30),
              candidate.start_time.slice(0, 5),
              candidate.end_time?.slice(0, 5) ?? addMinutes(candidate.start_time, 30),
            )
          );
        });

        return (
          <AssignedClassBlock
            key={assignment.id}
            assignment={assignment}
            danceClass={danceClass}
            top={top}
            height={heightInPixels}
            hasWarning={hasTeacherConflict}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onRemove={onRemove}
          />
        );
      })}
    </div>
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
  const duration = getClassDurationMinutes(danceClass);

  return (
    <article
      draggable={draggable && duration > 0}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        const payload = JSON.stringify({
          classId: danceClass.id,
        } satisfies DragPayload);
        event.dataTransfer.setData(
          "application/json",
          payload,
        );
        event.dataTransfer.setData("text/plain", payload);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`draggable-class-card rounded-md border bg-white p-2.5 shadow-sm transition ${
        duration > 0
          ? "cursor-grab hover:border-primary/50 hover:shadow-md active:cursor-grabbing"
          : "cursor-not-allowed border-amber-200 bg-amber-50"
      }`}
    >
      <p className="text-xs font-bold uppercase text-foreground">
        {danceClass.teacherName}
      </p>
      <p className="mt-0.5 truncate text-xs font-semibold text-foreground">
        {danceClass.name} · {danceClass.levelName}
      </p>
      <p className="truncate text-[11px] text-muted-foreground">
        {danceClass.modalityName}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {danceClass.schedulesLabel}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {duration > 0 ? formatDuration(duration) : "Sem horário"}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {danceClass.activeStudentsCount} alunos
        </span>
      </div>
      {draggable && duration > 0 ? (
        <p className="mt-1 text-[10px] font-medium text-muted-foreground">
          Arraste para a grade
        </p>
      ) : null}
      {duration <= 0 ? (
        <p className="mt-1 text-[11px] font-medium text-amber-800">
          Cadastre horário para alocar.
        </p>
      ) : null}
    </article>
  );
}

function AssignedClassBlock({
  assignment,
  danceClass,
  top,
  height,
  hasWarning,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  assignment: RoomRotationAssignment;
  danceClass: RoomRotationClassCard;
  top: number;
  height: number;
  hasWarning: boolean;
  onDragStart: (classId: string) => void;
  onDragEnd: () => void;
  onRemove: (assignmentId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        const payload = JSON.stringify({
          classId: danceClass.id,
        } satisfies DragPayload);
        event.dataTransfer.setData(
          "application/json",
          payload,
        );
        event.dataTransfer.setData("text/plain", payload);
        onDragStart(danceClass.id);
      }}
      onDragEnd={onDragEnd}
      className={`rotation-class-block group ${
        hasWarning ? "has-warning" : ""
      }`}
      style={{
        top,
        height: Math.max(height, minBlockHeight),
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase">
            {danceClass.teacherName}
          </p>
          <p className="truncate text-[11px] font-semibold">{danceClass.name}</p>
          <p className="truncate text-[10px] opacity-80">
            {assignment.start_time.slice(0, 5)}
            {assignment.end_time ? `-${assignment.end_time.slice(0, 5)}` : ""} ·{" "}
            {danceClass.activeStudentsCount} alunos
          </p>
          <p className="rotation-print-label hidden text-[10px] font-semibold">
            {danceClass.teacherName.toUpperCase()} - {danceClass.name.toUpperCase()} (
            {danceClass.activeStudentsCount})
          </p>
        </div>
        <button
          type="button"
          aria-label="Remover alocação"
          onClick={() => onRemove(assignment.id)}
          className="no-print shrink-0 rounded bg-white/80 px-1 text-[10px] font-bold text-muted-foreground opacity-80 hover:text-red-600 group-hover:opacity-100"
        >
          x
        </button>
      </div>
      {hasWarning ? (
        <p className="no-print mt-0.5 text-[10px] font-medium text-amber-800">
          Professor em conflito
        </p>
      ) : null}
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

function getClassDurationMinutes(danceClass?: RoomRotationClassCard | null) {
  if (!danceClass?.primaryStartTime || !danceClass.primaryEndTime) {
    return 0;
  }

  const duration = timeToMinutes(danceClass.primaryEndTime) -
    timeToMinutes(danceClass.primaryStartTime);

  return duration > 0 ? duration : 0;
}

function getAssignmentHeight(
  assignment: RoomRotationAssignment,
  danceClass: RoomRotationClassCard,
) {
  const assignmentDuration = assignment.end_time
    ? timeToMinutes(assignment.end_time.slice(0, 5)) -
      timeToMinutes(assignment.start_time.slice(0, 5))
    : 0;
  const duration = assignmentDuration > 0
    ? assignmentDuration
    : getClassDurationMinutes(danceClass);

  return Math.max((duration / 30) * slotHeight - 4, minBlockHeight);
}

function getSlotOffset(timeSlots: string[], time: string) {
  const normalized = time.slice(0, 5);
  const firstSlot = timeSlots[0] ?? normalized;
  const diff = timeToMinutes(normalized) - timeToMinutes(firstSlot);

  return Math.max((diff / 30) * slotHeight + 2, 2);
}

function intervalsOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) {
  return timeToMinutes(firstStart) < timeToMinutes(secondEnd) &&
    timeToMinutes(firstEnd) > timeToMinutes(secondStart);
}

function addMinutes(time: string, minutesToAdd: number) {
  return minutesToTime(timeToMinutes(time.slice(0, 5)) + minutesToAdd);
}

function timeToMinutes(time: string) {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) * 60 + Number(minute);
}

function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours > 0 && remainder > 0) {
    return `${hours}h${String(remainder).padStart(2, "0")}`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${remainder}min`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
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
