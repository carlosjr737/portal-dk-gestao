"use client";

type DeleteCalendarEventButtonProps = {
  action: (formData: FormData) => Promise<void>;
  eventId: string;
};

export function DeleteCalendarEventButton({
  action,
  eventId,
}: DeleteCalendarEventButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Tem certeza que deseja excluir este evento?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="event_id" value={eventId} />
      <button
        type="submit"
        className="text-sm font-medium text-red-600 hover:underline"
      >
        Excluir
      </button>
    </form>
  );
}
