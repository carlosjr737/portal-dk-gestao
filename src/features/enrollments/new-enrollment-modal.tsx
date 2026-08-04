"use client";

import { useActionState, useState } from "react";
import {
  createEnrollment,
  type EnrollmentActionState,
} from "@/features/enrollments/actions";
import type { TurmaDestino } from "@/features/enrollments/transfer-enrollment-modal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type ResponsavelOption = {
  id: string;
  nome: string;
};

type Props = {
  alunoId: string;
  alunoNome: string;
  turmas: TurmaDestino[];
  responsaveis: ResponsavelOption[];
  padroes: {
    inicio: string;
    fim: string;
    primeiroVencimento: string;
  };
};

const inicial: EnrollmentActionState = {};

/**
 * Matricular em mais uma turma sem sair da ficha.
 *
 * A tela cheia de `/matriculas/nova` existe para quem chega sem saber quem vai
 * matricular: ela busca aluno, busca turma e mostra horários. Aqui o aluno já
 * está na tela, e repetir aquele caminho custaria três navegações para
 * responder uma pergunta que a pessoa já respondeu ao abrir a ficha.
 *
 * O que sobrou são os campos que ainda faltam decidir. A action é a MESMA —
 * duplicar a criação de matrícula em dois lugares é como as duas telas
 * começariam a divergir em regra de negócio.
 */
export function NewEnrollmentModal({
  alunoId,
  alunoNome,
  turmas,
  responsaveis,
  padroes,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState(createEnrollment, inicial);
  const [turmaId, setTurmaId] = useState("");

  const destino = turmas.find((t) => t.id === turmaId);
  const lotada =
    destino?.capacidade != null && destino.alunosAtivos >= destino.capacidade;

  return (
    <>
      <Button size="sm" onClick={() => setAberto(true)} disabled={aberto}>
        Nova matrícula
      </Button>

      {aberto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-foreground">
            Nova matrícula
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{alunoNome}</p>

          {responsaveis.length === 0 ? (
            <Alert tone="warning" className="mt-5">
              Este aluno não tem responsável vinculado, e a matrícula precisa de
              um responsável financeiro. Vincule um em Responsáveis antes de
              matricular.
            </Alert>
          ) : null}

          <form action={formAction} className="mt-5 space-y-4">
            <input type="hidden" name="student_id" value={alunoId} />
            <input type="hidden" name="status" value="active" />

            <Field
              label="Turma"
              required
              error={state.errors?.class_id?.[0]}
            >
              <Select
                name="class_id"
                value={turmaId}
                onChange={(e) => setTurmaId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                    {t.capacidade != null
                      ? ` — ${t.alunosAtivos}/${t.capacidade}`
                      : ` — ${t.alunosAtivos} alunos`}
                  </option>
                ))}
              </Select>
            </Field>

            {lotada ? (
              <Alert tone="warning">
                Esta turma já está na capacidade. Dá para seguir mesmo assim — o
                sistema avisa, não impede.
              </Alert>
            ) : null}

            <Field
              label="Responsável financeiro"
              required
              hint="Só responsáveis já vinculados ao aluno."
              error={state.errors?.financial_guardian_id?.[0]}
            >
              <Select
                name="financial_guardian_id"
                defaultValue={
                  responsaveis.length === 1 ? responsaveis[0].id : ""
                }
              >
                <option value="">Selecione…</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Início"
                required
                error={state.errors?.start_date?.[0]}
              >
                <Input
                  type="date"
                  name="start_date"
                  defaultValue={padroes.inicio}
                />
              </Field>

              <Field
                label="Data final"
                required
                error={state.errors?.end_date?.[0]}
              >
                <Input type="date" name="end_date" defaultValue={padroes.fim} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="1º vencimento"
                required
                error={state.errors?.first_due_date?.[0]}
              >
                <Input
                  type="date"
                  name="first_due_date"
                  defaultValue={padroes.primeiroVencimento}
                />
              </Field>

              <Field
                label="Valor mensal"
                required
                error={state.errors?.monthly_amount?.[0]}
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  name="monthly_amount"
                  placeholder="0,00"
                />
              </Field>
            </div>

            {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setAberto(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={pending || responsaveis.length === 0}
              >
                {pending ? "Matriculando…" : "Matricular"}
              </Button>
            </div>
          </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
