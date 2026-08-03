"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type TurmaDestino = {
  id: string;
  nome: string;
  /** Para a pessoa ver se cabe antes de escolher. */
  alunosAtivos: number;
  capacidade: number | null;
};

type Props = {
  open: boolean;
  enrollmentId: string | null;
  alunoNome: string;
  turmaAtualId: string | null;
  turmaAtualNome: string;
  turmas: TurmaDestino[];
  onClose: () => void;
  onConfirm: (payload: {
    enrollmentId: string;
    novaTurmaId: string;
    motivo?: string;
  }) => Promise<void> | void;
};

/**
 * Troca de turma.
 *
 * A tela diz o que NÃO muda, e isso não é enfeite: a dúvida de quem clica é
 * "vou perder a matrícula dele?". Responder antes evita que a pessoa faça o
 * caminho antigo — cancelar e criar de novo — por insegurança.
 */
export function TransferEnrollmentModal({
  open,
  enrollmentId,
  alunoNome,
  turmaAtualId,
  turmaAtualNome,
  turmas,
  onClose,
  onConfirm,
}: Props) {
  const [novaTurmaId, setNovaTurmaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [tentou, setTentou] = useState(false);

  // A turma atual não pode ser destino dela mesma.
  const opcoes = useMemo(
    () => turmas.filter((t) => t.id !== turmaAtualId),
    [turmas, turmaAtualId],
  );

  const destino = opcoes.find((t) => t.id === novaTurmaId);
  const lotada =
    destino?.capacidade != null && destino.alunosAtivos >= destino.capacidade;

  if (!open || !enrollmentId) return null;

  function fechar() {
    setNovaTurmaId("");
    setMotivo("");
    setErro("");
    setTentou(false);
    setEnviando(false);
    onClose();
  }

  async function confirmar() {
    setTentou(true);
    if (!novaTurmaId) return;
    setEnviando(true);
    setErro("");
    try {
      await onConfirm({
        enrollmentId: enrollmentId as string,
        novaTurmaId,
        motivo: motivo.trim() || undefined,
      });
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível trocar de turma.");
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">Trocar de turma</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {alunoNome} · hoje em <strong className="font-medium">{turmaAtualNome}</strong>
        </p>

        <div className="mt-5 space-y-4">
          <Field label="Nova turma" required
            error={tentou && !novaTurmaId ? "Escolha a turma de destino." : undefined}>
            <Select
              value={novaTurmaId}
              onChange={(e) => setNovaTurmaId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {opcoes.map((t) => (
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
            label="Motivo"
            hint="Aparece no histórico da matrícula. Ajuda quem for olhar depois."
          >
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: conflito com o horário da escola"
            />
          </Field>

          {/*
            A dúvida de quem clica é "vou perder a matrícula dele?". Melhor
            responder aqui do que a pessoa cancelar e recriar por insegurança.
          */}
          <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            A matrícula continua a mesma: valor, desconto, responsável
            financeiro, data de início e cobrança seguem como estão.{" "}
            <strong className="font-medium text-foreground">
              Não conta como saída
            </strong>{" "}
            e a chamada já registrada fica na turma antiga.
          </div>

          {erro ? <Alert tone="danger">{erro}</Alert> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={fechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando ? "Trocando…" : "Trocar de turma"}
          </Button>
        </div>
      </div>
    </div>
  );
}
