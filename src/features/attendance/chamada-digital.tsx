"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  alternarAulaCancelada,
  salvarChamada,
} from "@/features/attendance/presenca-actions";
import type {
  ChamadaDaTurma,
  StatusPresenca,
} from "@/features/attendance/presenca-queries";
import { hojeISO } from "@/features/attendance/presenca-datas";

const STATUS: Array<{ valor: StatusPresenca; letra: string; rotulo: string }> = [
  { valor: "presente", letra: "P", rotulo: "Presente" },
  { valor: "falta", letra: "F", rotulo: "Falta" },
  { valor: "justificada", letra: "J", rotulo: "Justificada" },
];

/**
 * Chamada digital de uma turma.
 *
 * Pensada para o celular do professor, em pé, no meio da sala: alvos de toque
 * grandes, um dia por vez, e "marcar todos presentes" como primeiro gesto —
 * na maioria das aulas quase todo mundo veio, e é mais rápido desmarcar dois
 * do que marcar dezoito.
 */
export function ChamadaDigital({ chamada }: { chamada: ChamadaDaTurma }) {
  const hoje = hojeISO();

  // Abre no dia certo sem perguntar: hoje, se hoje tem aula; senão, a última
  // aula que já passou — que é a que provavelmente falta registrar.
  const dataInicial = useMemo(() => {
    const hojeTemAula = chamada.datas.find((d) => d.iso === hoje);
    if (hojeTemAula) return hojeTemAula.iso;
    const passadas = chamada.datas.filter((d) => d.iso <= hoje);
    return passadas[passadas.length - 1]?.iso ?? chamada.datas[0]?.iso ?? "";
  }, [chamada.datas, hoje]);

  const [dataSelecionada, setDataSelecionada] = useState(dataInicial);
  const [marcacoes, setMarcacoes] = useState<Record<string, StatusPresenca>>({});
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, iniciarSalvar] = useTransition();

  const diaAtual = chamada.datas.find((d) => d.iso === dataSelecionada);

  /** O que já está gravado no dia, sobreposto pelo que foi mexido agora. */
  function statusDe(studentId: string): StatusPresenca | undefined {
    return (
      marcacoes[studentId] ??
      chamada.registros[`${studentId}|${dataSelecionada}`]
    );
  }

  /** Quantos alunos já têm registro num dia — para o seletor de datas. */
  function registradosEm(iso: string) {
    return chamada.alunos.filter(
      (a) => chamada.registros[`${a.studentId}|${iso}`],
    ).length;
  }

  function trocarDia(iso: string) {
    setDataSelecionada(iso);
    setMarcacoes({});
    setAviso(null);
  }

  function marcar(studentId: string, status: StatusPresenca) {
    setMarcacoes((atual) => ({ ...atual, [studentId]: status }));
    setAviso(null);
  }

  function marcarTodos(status: StatusPresenca) {
    setMarcacoes(
      Object.fromEntries(chamada.alunos.map((a) => [a.studentId, status])),
    );
    setAviso(null);
  }

  const semMarcar = chamada.alunos.filter((a) => !statusDe(a.studentId));
  const presentes = chamada.alunos.filter(
    (a) => statusDe(a.studentId) === "presente",
  ).length;

  function salvar() {
    const marcados = chamada.alunos
      .map((a) => ({ aluno: a, status: statusDe(a.studentId) }))
      .filter((m): m is { aluno: typeof m.aluno; status: StatusPresenca } =>
        Boolean(m.status),
      );

    if (marcados.length === 0) {
      setAviso({ ok: false, texto: "Marque pelo menos um aluno." });
      return;
    }

    iniciarSalvar(async () => {
      const r = await salvarChamada({
        classId: chamada.turmaId,
        data: dataSelecionada,
        marcacoes: marcados.map((m) => ({
          studentId: m.aluno.studentId,
          enrollmentId: m.aluno.enrollmentId,
          status: m.status,
        })),
      });
      setAviso({ ok: Boolean(r.ok), texto: r.message ?? "" });
      if (r.ok) setMarcacoes({});
    });
  }

  function alternarCancelamento() {
    iniciarSalvar(async () => {
      const r = await alternarAulaCancelada({
        classId: chamada.turmaId,
        data: dataSelecionada,
      });
      setAviso({ ok: Boolean(r.ok), texto: r.message ?? "" });
    });
  }

  if (chamada.datas.length === 0) {
    return (
      <Alert tone="warning" className="mt-6">
        Esta turma não tem horários cadastrados, então não há datas de aula
        neste mês. Cadastre os horários na turma para poder fazer a chamada.
      </Alert>
    );
  }

  if (chamada.alunos.length === 0) {
    return (
      <Alert tone="warning" className="mt-6">
        Nenhum aluno com matrícula ativa nesta turma.
      </Alert>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Seletor de dia. Rola na horizontal no celular. */}
      <div>
        <p className="text-sm font-medium text-foreground">Dia da aula</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          {chamada.datas.map((d) => {
            const registrados = registradosEm(d.iso);
            const completo = registrados === chamada.alunos.length;
            const selecionado = d.iso === dataSelecionada;

            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => trocarDia(d.iso)}
                aria-current={selecionado ? "date" : undefined}
                className={cn(
                  "flex min-w-[76px] shrink-0 flex-col items-center rounded-md border px-3 py-2 text-sm transition",
                  selecionado
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                <span className="text-xs opacity-80">{d.diaDaSemana}</span>
                <span className="font-semibold">{d.label}</span>
                {/*
                  O ponto diz de longe o que já foi feito: cheio = dia
                  fechado, vazado = começou e parou, nada = intocado.
                */}
                <span className="mt-1 text-[10px] leading-none">
                  {d.cancelada
                    ? "sem aula"
                    : completo
                      ? "●"
                      : registrados > 0
                        ? "◐"
                        : "○"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {aviso ? (
        <Alert tone={aviso.ok ? "success" : "danger"}>{aviso.texto}</Alert>
      ) : null}

      {diaAtual?.cancelada ? (
        <Alert tone="info" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <strong className="font-medium">{diaAtual.label}</strong> está
            marcado como sem aula
            {diaAtual.motivoCancelamento
              ? ` (${diaAtual.motivoCancelamento})`
              : ""}
            . Ninguém falta neste dia.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={alternarCancelamento}
            disabled={salvando}
          >
            Reabrir o dia
          </Button>
        </Alert>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {presentes} de {chamada.alunos.length} presentes
                {semMarcar.length > 0 ? (
                  <span className="ml-2 text-amber-700">
                    · {semMarcar.length} sem marcar
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => marcarTodos("presente")}
                >
                  Todos presentes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={alternarCancelamento}
                  disabled={salvando}
                >
                  Não houve aula
                </Button>
              </div>
            </div>
          </Card>

          <Card className="divide-y divide-border">
            {chamada.alunos.map((aluno) => {
              const status = statusDe(aluno.studentId);

              return (
                <div
                  key={aluno.studentId}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {aluno.nome}
                    </span>
                    {!status ? (
                      <Badge tone="warning">sem marcar</Badge>
                    ) : null}
                  </div>

                  {/*
                    role="radiogroup" e não três botões soltos: para quem usa
                    leitor de tela, é UMA pergunta com três respostas, não três
                    perguntas de sim ou não.
                  */}
                  <div
                    role="radiogroup"
                    aria-label={`Presença de ${aluno.nome}`}
                    className="flex gap-2"
                  >
                    {STATUS.map((op) => {
                      const ativo = status === op.valor;
                      return (
                        <button
                          key={op.valor}
                          type="button"
                          role="radio"
                          aria-checked={ativo}
                          aria-label={op.rotulo}
                          onClick={() => marcar(aluno.studentId, op.valor)}
                          className={cn(
                            "h-11 w-11 rounded-md border text-sm font-semibold transition",
                            ativo && op.valor === "presente" &&
                              "border-emerald-600 bg-emerald-600 text-white",
                            ativo && op.valor === "falta" &&
                              "border-destructive bg-destructive text-destructive-foreground",
                            ativo && op.valor === "justificada" &&
                              "border-amber-500 bg-amber-500 text-white",
                            !ativo &&
                              "border-border bg-card text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {op.letra}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={salvar} disabled={salvando} size="lg">
              {salvando ? "Salvando..." : "Salvar chamada"}
            </Button>
            {semMarcar.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {semMarcar.length} aluno{semMarcar.length > 1 ? "s" : ""} sem
                marcar {semMarcar.length > 1 ? "ficarão" : "ficará"} de fora.
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
