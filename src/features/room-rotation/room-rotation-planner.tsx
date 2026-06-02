"use client";

import { useMemo, useState } from "react";
import {
  copyPreviousRoomRotationPlan,
  createRoomRotationPlan,
  deleteRoomRotationAssignment,
  publishRoomRotationPlan,
  saveRoomRotationAssignment,
} from "@/features/room-rotation/actions";
import {
  getRoomRotationDayGroupLabel,
  roomRotationDayGroupOptions,
  roomRotationLabels,
  formatRotationMonth,
} from "@/features/room-rotation/constants";
import type {
  Room,
  RoomRotationAssignment,
  RoomRotationClassCard,
  RoomRotationConflict,
  RoomRotationDayGroup,
  RoomRotationPageData,
} from "@/features/room-rotation/types";

type RoomRotationPlannerProps = {
  data: RoomRotationPageData;
  filters: {
    year: number;
    month: number;
    dayGroup: RoomRotationDayGroup;
    rotationLabel: string;
    status?: string;
  };
};

export function RoomRotationPlanner({
  data,
  filters,
}: RoomRotationPlannerProps) {
  const [selectedClassId, setSelectedClassId] = useState("");
  const assignmentsByClassId = useMemo(
    () => new Map(data.assignments.map((assignment) => [assignment.class_id, assignment])),
    [data.assignments],
  );
  const classById = useMemo(
    () => new Map(data.classes.map((danceClass) => [danceClass.id, danceClass])),
    [data.classes],
  );
  const availableClasses = data.classes.filter(
    (danceClass) => !assignmentsByClassId.has(danceClass.id),
  );
  const sourcePlans = data.plans.filter(
    (plan) => plan.id !== data.selectedPlan?.id,
  );

  return (
    <div className="space-y-6">
      <section className="no-print rounded-md border border-border bg-white p-4">
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
            label="Rodízio/Semana"
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
              Limpar filtros
            </a>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <PlanActionForm filters={filters} action={createRoomRotationPlan}>
            <button className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-white">
              Novo rodízio
            </button>
          </PlanActionForm>

          {data.selectedPlan ? (
            <>
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
                    Copiar rodízio anterior
                  </button>
                </form>
              ) : null}

              <span className="inline-flex h-10 items-center rounded-md bg-muted px-3 text-sm font-medium">
                {data.selectedPlan.status === "published"
                  ? "Publicado"
                  : "Rascunho"}
              </span>
            </>
          ) : null}
        </div>
      </section>

      {!data.selectedPlan ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-800">
          Crie um novo rodízio para começar a montar as salas.
        </div>
      ) : null}

      {data.rooms.length === 0 ? (
        <div className="rounded-md border border-border bg-white px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma sala cadastrada.
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <aside className="no-print rounded-md border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">Turmas disponíveis</h2>
            <p className="text-xs text-muted-foreground">
              {availableClasses.length} turmas para alocar
            </p>
          </div>
          <div className="max-h-[760px] space-y-3 overflow-y-auto p-4">
            {availableClasses.length > 0 ? (
              availableClasses.map((danceClass) => (
                <AvailableClassCard
                  key={danceClass.id}
                  danceClass={danceClass}
                  selected={selectedClassId === danceClass.id}
                  onSelect={() => setSelectedClassId(danceClass.id)}
                  rooms={data.rooms}
                  timeSlots={data.timeSlots}
                  planId={data.selectedPlan?.id ?? ""}
                  filters={filters}
                  disabled={!data.selectedPlan}
                />
              ))
            ) : (
              <p className="rounded-md border border-border bg-muted px-3 py-4 text-sm text-muted-foreground">
                Nenhuma turma encontrada para os filtros selecionados.
              </p>
            )}
          </div>
        </aside>

        <div className="rotation-print-area overflow-hidden rounded-md border border-border bg-white">
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
              {data.conflicts.slice(0, 4).map((conflict) => conflict.message).join(" | ")}
              {data.conflicts.length > 4 ? " | ..." : ""}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="rotation-grid w-full min-w-[980px] border-collapse">
              <thead>
                <tr>
                  <th className="w-24 border border-border bg-muted px-3 py-3 text-left text-xs uppercase text-muted-foreground">
                    Horário
                  </th>
                  {data.rooms.map((room) => (
                    <th
                      key={room.id}
                      className="border border-border px-3 py-3 text-left text-xs uppercase text-foreground"
                      style={{ backgroundColor: room.color ?? "#f8fafc" }}
                    >
                      {room.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.timeSlots.map((timeSlot) => (
                  <tr key={timeSlot}>
                    <td className="border border-border bg-muted/60 px-3 py-3 text-sm font-semibold">
                      {timeSlot}
                    </td>
                    {data.rooms.map((room) => {
                      const cellAssignments = data.assignments.filter(
                        (assignment) =>
                          assignment.room_id === room.id &&
                          assignment.start_time.slice(0, 5) === timeSlot,
                      );

                      return (
                        <td
                          key={`${room.id}-${timeSlot}`}
                          className="h-28 min-w-[210px] align-top border border-border bg-white p-2"
                        >
                          {cellAssignments.map((assignment) => {
                            const danceClass = classById.get(assignment.class_id);
                            return danceClass ? (
                              <AssignedClassCard
                                key={assignment.id}
                                assignment={assignment}
                                danceClass={danceClass}
                                rooms={data.rooms}
                                timeSlots={data.timeSlots}
                                filters={filters}
                                conflicts={data.conflicts}
                              />
                            ) : null;
                          })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function AvailableClassCard({
  danceClass,
  selected,
  onSelect,
  rooms,
  timeSlots,
  planId,
  filters,
  disabled,
}: {
  danceClass: RoomRotationClassCard;
  selected: boolean;
  onSelect: () => void;
  rooms: Room[];
  timeSlots: string[];
  planId: string;
  filters: RoomRotationPlannerProps["filters"];
  disabled: boolean;
}) {
  return (
    <article
      className={`rounded-md border p-3 ${selected ? "border-primary bg-primary/5" : "border-border bg-white"}`}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <ClassCardContent danceClass={danceClass} />
      </button>
      {!danceClass.hasAnySchedule ? (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Turma sem horário cadastrado.
        </p>
      ) : null}
      <form action={saveRoomRotationAssignment} className="mt-3 grid gap-2">
        <HiddenFilters filters={filters} />
        <input type="hidden" name="rotationPlanId" value={planId} />
        <input type="hidden" name="classId" value={danceClass.id} />
        <AllocationControls
          rooms={rooms}
          timeSlots={timeSlots}
          defaultStartTime={danceClass.primaryStartTime ?? timeSlots[0] ?? "14:00"}
        />
        <button
          disabled={disabled}
          className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Alocar
        </button>
      </form>
    </article>
  );
}

function AssignedClassCard({
  assignment,
  danceClass,
  rooms,
  timeSlots,
  filters,
  conflicts,
}: {
  assignment: RoomRotationAssignment;
  danceClass: RoomRotationClassCard;
  rooms: Room[];
  timeSlots: string[];
  filters: RoomRotationPlannerProps["filters"];
  conflicts: RoomRotationConflict[];
}) {
  const hasConflict = conflicts.some(
    (conflict) =>
      conflict.assignmentId === assignment.id || conflict.classId === danceClass.id,
  );

  return (
    <div
      className={`rounded-md border p-2 shadow-sm ${
        hasConflict ? "border-amber-300 bg-amber-50" : "border-primary/20 bg-primary/5"
      }`}
    >
      <ClassCardContent danceClass={danceClass} compact />
      {hasConflict ? (
        <p className="mt-1 text-[11px] font-medium text-amber-800">
          Alerta de conflito
        </p>
      ) : null}
      <div className="no-print mt-2 grid gap-2">
        <form action={saveRoomRotationAssignment} className="grid gap-2">
          <HiddenFilters filters={filters} />
          <input type="hidden" name="rotationPlanId" value={assignment.rotation_plan_id} />
          <input type="hidden" name="classId" value={danceClass.id} />
          <AllocationControls
            rooms={rooms}
            timeSlots={timeSlots}
            defaultRoomId={assignment.room_id}
            defaultStartTime={assignment.start_time.slice(0, 5)}
            defaultEndTime={assignment.end_time?.slice(0, 5) ?? ""}
          />
          <button className="h-8 rounded-md border border-border px-2 text-xs font-medium">
            Mover
          </button>
        </form>
        <form action={deleteRoomRotationAssignment}>
          <HiddenFilters filters={filters} />
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <button className="h-8 w-full rounded-md border border-border px-2 text-xs font-medium text-red-600">
            Remover
          </button>
        </form>
      </div>
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
  return (
    <div>
      <p className={`${compact ? "text-xs" : "text-sm"} font-bold uppercase text-foreground`}>
        {danceClass.teacherName}
      </p>
      <p className={`${compact ? "text-xs" : "text-sm"} font-semibold text-foreground`}>
        {danceClass.levelName} · {danceClass.name}
      </p>
      <p className="text-xs text-muted-foreground">
        {danceClass.activeStudentsCount} alunos · {danceClass.schedulesLabel}
      </p>
      <p className="rotation-print-label mt-1 hidden text-xs font-semibold">
        {danceClass.teacherName.toUpperCase()} - {danceClass.name.toUpperCase()} (
        {danceClass.activeStudentsCount})
      </p>
    </div>
  );
}

function AllocationControls({
  rooms,
  timeSlots,
  defaultRoomId,
  defaultStartTime,
  defaultEndTime,
}: {
  rooms: Room[];
  timeSlots: string[];
  defaultRoomId?: string;
  defaultStartTime: string;
  defaultEndTime?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        name="roomId"
        defaultValue={defaultRoomId ?? rooms[0]?.id ?? ""}
        className="h-9 rounded-md border border-border bg-white px-2 text-xs"
      >
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}
          </option>
        ))}
      </select>
      <select
        name="startTime"
        defaultValue={defaultStartTime}
        className="h-9 rounded-md border border-border bg-white px-2 text-xs"
      >
        {timeSlots.map((timeSlot) => (
          <option key={timeSlot} value={timeSlot}>
            {timeSlot}
          </option>
        ))}
      </select>
      <input type="hidden" name="endTime" value={defaultEndTime ?? ""} />
    </div>
  );
}

function PlanActionForm({
  filters,
  rotationPlanId,
  action,
  children,
}: {
  filters: RoomRotationPlannerProps["filters"];
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

function HiddenFilters({ filters }: { filters: RoomRotationPlannerProps["filters"] }) {
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
