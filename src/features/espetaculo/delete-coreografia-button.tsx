"use client";

import { deleteCoreografia } from "@/features/espetaculo/actions";
import { Button } from "@/components/ui/button";

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
      <Button
        variant="outline"
        size="sm"
        type="submit"
        className="h-8 border-destructive/40 text-xs text-destructive hover:bg-destructive/5"
      >
        Remover
      </Button>
    </form>
  );
}
