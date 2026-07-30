"use client";

import { deleteCoreografia } from "@/features/espetaculo/actions";

export function DeleteCoreografiaButton({
  espetaculoId,
  coreografiaId,
}: {
  espetaculoId: string;
  coreografiaId: string;
}) {
  const action = deleteCoreografia.bind(null, espetaculoId, coreografiaId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Remover esta coreografia?")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex h-8 items-center rounded-md border border-rose-200 px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
      >
        Remover
      </button>
    </form>
  );
}
