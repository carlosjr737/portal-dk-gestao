"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelEnrollment } from "@/features/enrollments/actions";
import { CancelEnrollmentModal } from "@/features/enrollments/cancel-enrollment-modal";
import {
  TransferEnrollmentModal,
  type TurmaDestino,
} from "@/features/enrollments/transfer-enrollment-modal";
import { transferirMatricula } from "@/features/enrollments/transfer-actions";
import {
  formatEnrollmentStatus,
  formatFinancialGuardianName,
  formatMoney,
} from "@/features/enrollments/formatters";
import type { EnrollmentStatus } from "@/features/enrollments/schemas";
import {
  formatDate,
  formatDateTime,
  formatText,
} from "@/features/students/formatters";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

/*
 * Verde para quem está estudando, âmbar para o que exige decisão (pausada, em
 * avaliação), vermelho só para cancelada. Encerrada é cinza porque é fato
 * consumado, não problema — pintá-la de vermelho faria o histórico de fim de
 * ano parecer um monte de evasão.
 */
const TOM_DO_STATUS: Record<
  EnrollmentStatus,
  NonNullable<BadgeProps["tone"]>
> = {
  active: "success",
  paused: "warning",
  evaluation: "warning",
  ended: "neutral",
  cancelled: "danger",
};

export type StudentEnrollmentItem = {
  id: string;
  status: EnrollmentStatus;
  start_date: string | null;
  end_date: string | null;
  monthly_amount: number | null;
  financialGuardianName: string | null;
  cancellation_reason: string | null;
  cancellation_notes: string | null;
  cancelled_at: string | null;
  class: {
    id: string;
    name: string;
    category: string | null;
    teacherName: string | null;
  };
};

type StudentEnrollmentsSectionProps = {
  enrollments: StudentEnrollmentItem[];
  loadError?: string | null;
  /** Nome do aluno, para o modal de troca dizer de quem se trata. */
  alunoNome?: string;
  /** Turmas ativas com ocupação, para escolher o destino da troca. */
  turmasDestino?: TurmaDestino[];
  /**
   * Ação principal da seção — hoje, "Nova matrícula".
   *
   * Vem de fora em vez de ser montada aqui porque depende de dados que só a
   * página tem (responsáveis vinculados, vencimento padrão da escola), e
   * buscá-los aqui obrigaria esta seção a virar server component.
   */
  acaoCabecalho?: React.ReactNode;
};

export function StudentEnrollmentsSection({
  enrollments,
  loadError,
  alunoNome = "Aluno",
  turmasDestino = [],
  acaoCabecalho,
}: StudentEnrollmentsSectionProps) {
  const router = useRouter();
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<
    string | null
  >(null);
  const [trocandoId, setTrocandoId] = useState<string | null>(null);
  const [avisoTroca, setAvisoTroca] = useState("");

  const emTroca = enrollments.find((e) => e.id === trocandoId);
  const ativas = enrollments.filter((e) => e.status === "active").length;

  async function handleTransfer(payload: {
    enrollmentId: string;
    novaTurmaId: string;
    motivo?: string;
  }) {
    const r = await transferirMatricula(payload);
    if (!r.ok) throw new Error(r.message);
    setAvisoTroca(r.message);
    router.refresh();
  }

  async function handleConfirm(payload: {
    enrollmentId: string;
    cancellationReason: string;
    cancellationNotes?: string;
  }) {
    const formData = new FormData();
    formData.set("enrollment_id", payload.enrollmentId);
    formData.set("cancellation_reason", payload.cancellationReason);
    formData.set("cancellation_notes", payload.cancellationNotes ?? "");

    const result = await cancelEnrollment({}, formData);

    if (!result.success) {
      throw new Error(result.message ?? "Não foi possível cancelar a matrícula.");
    }

    router.refresh();
  }

  return (
    <section
      id="matriculas"
      className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Matrículas do aluno
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ativas === 0
              ? "Nenhuma turma ativa no momento."
              : `${ativas} ${ativas === 1 ? "turma ativa" : "turmas ativas"}`}
          </p>
        </div>
        {acaoCabecalho}
      </div>
      {loadError ? (
        <Alert tone="warning" className="border-b px-5">
          Não foi possível carregar as matrículas do aluno.
        </Alert>
      ) : null}
      {avisoTroca ? (
        <Alert tone="success" className="border-b px-5">
          {avisoTroca}
        </Alert>
      ) : null}
      {/* w-auto min-w-full: com 9 colunas, largura fixa espremeria as células
          em vez de deixar rolar na horizontal. */}
      <Table
        containerClassName="rounded-none border-0"
        className="w-auto min-w-full"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Turma</TableHead>
            <TableHead>Modalidade</TableHead>
            <TableHead>Professor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Final</TableHead>
            <TableHead>Resp. financeiro</TableHead>
            <TableHead>Valor mensal</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enrollments.length > 0 ? (
            enrollments.map((enrollment) => (
              <TableRow key={enrollment.id}>
                <TableCell>
                  <Link
                    href={`/turmas/${enrollment.class.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {enrollment.class.name}
                  </Link>
                  {enrollment.status === "cancelled" ? (
                    <Alert tone="danger" className="mt-2 px-3 py-2 text-xs">
                      <p>Motivo: {formatText(enrollment.cancellation_reason)}</p>
                      {enrollment.cancellation_notes ? (
                        <p className="mt-1">
                          Observação:{" "}
                          {formatText(enrollment.cancellation_notes)}
                        </p>
                      ) : null}
                      <p className="mt-1">
                        Cancelada em: {formatDateTime(enrollment.cancelled_at)}
                      </p>
                    </Alert>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatText(enrollment.class.category)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatText(enrollment.class.teacherName)}
                </TableCell>
                <TableCell>
                  {/*
                    Pílula, não texto solto: é a mesma informação de "Ativo" na
                    ficha e de "Pago" no financeiro, e ler as três telas com o
                    mesmo verde é o que dispensa ler a palavra.
                  */}
                  <Badge tone={TOM_DO_STATUS[enrollment.status]}>
                    {formatEnrollmentStatus(enrollment.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(enrollment.start_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(enrollment.end_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFinancialGuardianName(enrollment.financialGuardianName)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatMoney(enrollment.monthly_amount)}
                </TableCell>
                <TableCell>
                  {enrollment.status === "active" ? (
                    <div className="flex flex-wrap gap-2">
                      {/*
                        Trocar vem antes de Cancelar de propósito: é a ação
                        que a pessoa quer na maioria das vezes que chega aqui
                        querendo "tirar da turma".
                      */}
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setTrocandoId(enrollment.id)}
                      >
                        Trocar de turma
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setSelectedEnrollmentId(enrollment.id)}
                        className="border-destructive/40 text-destructive hover:bg-destructive/5"
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={9}>
              <p className="font-medium text-foreground">
                Este aluno ainda não está em nenhuma turma.
              </p>
              <p className="mt-1">
                Use &ldquo;Nova matrícula&rdquo; para vincular a primeira.
              </p>
            </TableEmpty>
          )}
        </TableBody>
      </Table>

      <CancelEnrollmentModal
        open={Boolean(selectedEnrollmentId)}
        enrollmentId={selectedEnrollmentId}
        onClose={() => setSelectedEnrollmentId(null)}
        onConfirm={handleConfirm}
      />

      <TransferEnrollmentModal
        open={Boolean(trocandoId)}
        enrollmentId={trocandoId}
        alunoNome={alunoNome}
        turmaAtualId={emTroca?.class.id ?? null}
        turmaAtualNome={emTroca?.class.name ?? "-"}
        turmas={turmasDestino}
        onClose={() => setTrocandoId(null)}
        onConfirm={handleTransfer}
      />
    </section>
  );
}
