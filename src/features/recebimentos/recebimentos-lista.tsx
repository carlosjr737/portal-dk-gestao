"use client";

import { useActionState, useState } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  desmarcarRecebido,
  marcarRecebido,
  type RecebimentoState,
} from "@/features/recebimentos/actions";
import type { LinhaRecebimento } from "@/features/recebimentos/queries";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function diaMes(iso: string | null) {
  if (!iso) return null;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * A lista de conciliação.
 *
 * Um componente de cliente para a lista inteira, não um por linha: com
 * centenas de cobranças no mês, 666 ilhas de hidratação custam mais que
 * guardar em estado qual linha está aberta.
 */
export function RecebimentosLista({
  linhas,
  competencia,
  hoje,
}: {
  linhas: LinhaRecebimento[];
  competencia: string;
  hoje: string;
}) {
  const [aberta, setAberta] = useState<string | null>(null);

  if (linhas.length === 0) {
    return (
      <p className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground">
        Nenhuma cobrança neste filtro.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border border-t border-border">
      {linhas.map((linha) => (
        <li key={linha.enrollmentId}>
          <Linha
            linha={linha}
            competencia={competencia}
            hoje={hoje}
            aberta={aberta === linha.enrollmentId}
            onAbrir={() =>
              setAberta((atual) =>
                atual === linha.enrollmentId ? null : linha.enrollmentId,
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}

function Linha({
  linha,
  competencia,
  hoje,
  aberta,
  onAbrir,
}: {
  linha: LinhaRecebimento;
  competencia: string;
  hoje: string;
  aberta: boolean;
  onAbrir: () => void;
}) {
  const [estado, marcar, marcando] = useActionState<RecebimentoState, FormData>(
    marcarRecebido,
    {},
  );
  const [estadoDesmarcar, desmarcar, desmarcando] = useActionState<
    RecebimentoState,
    FormData
  >(desmarcarRecebido, {});

  const venceu =
    !linha.paga && linha.vencimento !== null && linha.vencimento < hoje;

  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-4">
        {/* O marcador é o que se lê ao rolar — 24px, à esquerda, sempre. */}
        <span
          aria-hidden="true"
          className={
            linha.paga
              ? "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success text-white"
              : "h-6 w-6 shrink-0 rounded-full border-2 border-input"
          }
        >
          {linha.paga ? <Check className="h-3.5 w-3.5" /> : null}
        </span>

        <span className="min-w-0 flex-1 leading-tight">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">
              {linha.alunoNome}
            </span>
            {linha.travada ? (
              <Lock
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-label="Atualizada pelo Asaas, somente leitura"
              />
            ) : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[linha.responsavelNome, linha.turmaNome].filter(Boolean).join(" · ") ||
              "Sem responsável financeiro"}
          </span>
        </span>

        <span className="w-24 shrink-0 text-right text-sm tabular-nums text-foreground">
          {brl.format(linha.valor)}
        </span>

        {/* Atraso pinta a DATA, não a linha inteira: atraso é comum, e 43
            linhas vermelhas anestesiam a cor. */}
        <span
          className={`w-14 shrink-0 text-right text-xs tabular-nums ${
            venceu ? "font-semibold text-danger-text" : "text-muted-foreground"
          }`}
        >
          {diaMes(linha.vencimento) ?? "—"}
        </span>

        <span className="w-40 shrink-0 text-right">
          {linha.travada ? (
            <span className="text-xs text-muted-foreground">
              {linha.detalheAsaas}
            </span>
          ) : linha.paga ? (
            <form action={desmarcar}>
              <input type="hidden" name="enrollment_id" value={linha.enrollmentId} />
              <input type="hidden" name="competencia" value={competencia} />
              <Button
                variant="ghost"
                size="sm"
                type="submit"
                disabled={desmarcando}
                className="text-muted-foreground"
              >
                {desmarcando
                  ? "Desmarcando…"
                  : `recebida em ${diaMes(linha.recebidoEm)}`}
              </Button>
            </form>
          ) : (
            <Button variant="outline" size="sm" type="button" onClick={onAbrir}>
              Marcar recebida
            </Button>
          )}
        </span>
      </div>

      {aberta && !linha.paga && !linha.travada ? (
        <form
          action={marcar}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted px-4 py-3"
        >
          <input type="hidden" name="enrollment_id" value={linha.enrollmentId} />
          <input type="hidden" name="competencia" value={competencia} />

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

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Valor
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              name="valor"
              defaultValue={linha.valor.toFixed(2)}
              className="w-[128px] tabular-nums"
            />
          </label>

          <Button type="submit" size="sm" disabled={marcando}>
            {marcando ? "Confirmando…" : "Confirmar"}
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={onAbrir}>
            Cancelar
          </Button>

          <p className="w-full text-xs text-muted-foreground">
            O valor vem da mensalidade da matrícula. Mude só se entrou diferente.
          </p>
        </form>
      ) : null}

      {estado.message && estado.ok === false ? (
        <p className="mt-2 text-xs text-danger-text">{estado.message}</p>
      ) : null}
      {estadoDesmarcar.message && estadoDesmarcar.ok === false ? (
        <p className="mt-2 text-xs text-danger-text">{estadoDesmarcar.message}</p>
      ) : null}
    </div>
  );
}
