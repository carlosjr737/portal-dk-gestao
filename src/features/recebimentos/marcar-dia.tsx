"use client";

import { useActionState, useState } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  marcarDiaRecebido,
  type RecebimentoState,
} from "@/features/recebimentos/actions";

/**
 * Ação em lote por dia de vencimento.
 *
 * Só aparece quando existe dia com cobrança em aberto — botão que não faz nada
 * é pior que botão ausente. As linhas do Asaas são excluídas no servidor, não
 * aqui: a tela não decide o que é somente leitura.
 */
export function MarcarDia({
  competencia,
  dias,
  hoje,
}: {
  competencia: string;
  dias: number[];
  hoje: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, executar, executando] = useActionState<
    RecebimentoState,
    FormData
  >(marcarDiaRecebido, {});

  if (!aberto) {
    return (
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setAberto(true)}
      >
        <CheckCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        Marcar todas de um dia
      </Button>
    );
  }

  return (
    <form action={executar} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="competencia" value={competencia} />

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Vencimento
        </span>
        <Select name="dia" className="w-[104px] py-2" defaultValue={String(dias[0])}>
          {dias.map((dia) => (
            <option key={dia} value={dia}>
              dia {String(dia).padStart(2, "0")}
            </option>
          ))}
        </Select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          Recebido em
        </span>
        <Input
          type="date"
          name="recebido_em"
          defaultValue={hoje}
          required
          className="w-[168px]"
        />
      </label>

      <Button type="submit" size="sm" disabled={executando}>
        {executando ? "Marcando…" : "Marcar todas"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setAberto(false)}
      >
        Cancelar
      </Button>

      {estado.message ? (
        <p
          className={`w-full text-xs ${estado.ok === false ? "text-danger-text" : "text-muted-foreground"}`}
        >
          {estado.message}
        </p>
      ) : null}
    </form>
  );
}
