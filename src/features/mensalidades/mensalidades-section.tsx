"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CobrancaAlunoButton } from "@/features/baas/cobranca-aluno-button";
import { FaturaBotao } from "@/features/baas/fatura-modal";
import { editarCobrancaAsaas } from "@/features/mensalidades/actions";
import { BaixaManualModal } from "@/features/mensalidades/baixa-manual-modal";
import { EditarCobrancaModal } from "@/features/mensalidades/editar-cobranca-modal";
import { StatusMensalidadeBadge } from "@/features/mensalidades/status-badge";
import type {
  LinhaMensalidade,
  MensalidadesDoAluno,
} from "@/features/mensalidades/types";
import {
  desmarcarRecebido,
  marcarRecebido,
} from "@/features/recebimentos/actions";
import { formatDate } from "@/features/students/formatters";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Mensalidades do aluno, com as duas origens na mesma tabela.
 *
 * A coluna "Canal" não é enfeite de auditoria: ela explica por que a linha do
 * Asaas não tem "Dar baixa" e a manual não tem "Enviar cobrança". Sem a
 * coluna, a diferença de botões entre duas linhas parece defeito da tela.
 */
export function MensalidadesSection({
  dados,
  alunoId,
}: {
  dados: MensalidadesDoAluno;
  alunoId: string;
}) {
  const router = useRouter();
  const [baixando, setBaixando] = useState<LinhaMensalidade | null>(null);
  const [editando, setEditando] = useState<LinhaMensalidade | null>(null);
  const [aviso, setAviso] = useState<{ tom: "success" | "danger"; texto: string } | null>(
    null,
  );

  const semCobranca = dados.contratos.filter((c) => !c.temAssinatura);
  const compartilhados = dados.contratos.filter(
    (c) => c.outrosAlunos.length > 0,
  );

  async function darBaixa(payload: {
    enrollmentId: string;
    competencia: string;
    recebidoEm: string;
    valor: number;
  }) {
    const formData = new FormData();
    formData.set("enrollment_id", payload.enrollmentId);
    formData.set("competencia", payload.competencia);
    formData.set("recebido_em", payload.recebidoEm);
    formData.set("valor", String(payload.valor));

    const r = await marcarRecebido({}, formData);
    if (!r.ok) throw new Error(r.message ?? "Não foi possível dar baixa.");

    setAviso({ tom: "success", texto: "Baixa registrada." });
    router.refresh();
  }

  async function desfazerBaixa(linha: LinhaMensalidade) {
    if (!linha.enrollmentId) return;

    const formData = new FormData();
    formData.set("enrollment_id", linha.enrollmentId);
    formData.set("competencia", linha.competencia);

    const r = await desmarcarRecebido({}, formData);
    setAviso(
      r.ok
        ? { tom: "success", texto: "Baixa desfeita." }
        : { tom: "danger", texto: r.message ?? "Não foi possível desfazer." },
    );
    router.refresh();
  }

  async function editarCobranca(payload: {
    paymentId: string;
    valor: number;
    vencimento: string;
    billingType: string;
  }) {
    const contratoId = editando?.contratoId;
    if (!contratoId) throw new Error("Contrato não encontrado.");

    const formData = new FormData();
    formData.set("payment_id", payload.paymentId);
    formData.set("contrato_id", contratoId);
    formData.set("valor", String(payload.valor));
    formData.set("vencimento", payload.vencimento);
    formData.set("billing_type", payload.billingType);
    formData.set("student_id", alunoId);

    const r = await editarCobrancaAsaas({}, formData);
    if (!r.ok) throw new Error(r.message ?? "Não foi possível alterar.");

    setAviso({ tom: "success", texto: r.message ?? "Cobrança atualizada." });
    router.refresh();
  }

  return (
    <section
      id="financeiro"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Mensalidades
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dados.mensalidadeAtual > 0
              ? `${brl.format(dados.mensalidadeAtual)} por mês nas matrículas ativas`
              : "Sem mensalidade ativa."}
            {dados.emAberto > 0
              ? ` · ${dados.emAberto} em aberto (${brl.format(dados.valorEmAberto)})`
              : null}
          </p>
        </div>

        {/*
          Gerar cobrança é do CONTRATO, não da parcela: a assinatura recorrente
          nasce uma vez e passa a emitir os meses sozinha. Por isso o botão fica
          no cabeçalho da seção, e não repetido em cada linha.
        */}
        {semCobranca.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {semCobranca.map((contrato) => (
              <CobrancaAlunoButton
                key={contrato.contratoId}
                contratoId={contrato.contratoId}
                valor={contrato.valorTotal}
                jaTemCobranca={false}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 p-5 pb-0 empty:hidden">
        {dados.avisoProvedor ? (
          <Alert tone="warning">{dados.avisoProvedor}</Alert>
        ) : null}

        {/*
          O vazio precisa dizer POR QUE está vazio. Sem primeiro vencimento não
          existe dia em que a mensalidade vence, e sem isso não há mês para
          projetar — a tabela ficaria em branco como se não houvesse nada a
          cobrar, que é a leitura oposta da verdadeira.
        */}
        {dados.semVencimento.length > 0 ? (
          <Alert tone="warning">
            <p className="font-medium">
              Sem 1º vencimento em{" "}
              {dados.semVencimento.length === 1
                ? dados.semVencimento[0]
                : `${dados.semVencimento.length} matrículas`}
              .
            </p>
            <p className="mt-1">
              {dados.semVencimento.length > 1
                ? `${dados.semVencimento.join(", ")}. `
                : ""}
              Enquanto o dia do vencimento não estiver cadastrado, o sistema não
              tem como saber em que mês a mensalidade vence — e ela não aparece
              nem aqui nem na conciliação de recebimentos.
            </p>
          </Alert>
        ) : null}

        {aviso ? <Alert tone={aviso.tom}>{aviso.texto}</Alert> : null}

        {/*
          A assinatura do Asaas é do RESPONSÁVEL: irmãos dividem uma cobrança
          só. Sem este aviso, o valor da parcela parece não bater com a
          mensalidade deste aluno — e quem confere acha que a tela está errada.
        */}
        {compartilhados.map((contrato) => (
          <Alert key={contrato.contratoId} tone="info">
            A cobrança de {contrato.responsavelNome} é uma só para a família e
            inclui {contrato.outrosAlunos.join(", ")}. O valor das parcelas
            abaixo é o da família, não o deste aluno.
          </Alert>
        ))}
      </div>

      <Table containerClassName="rounded-none border-0 border-t" minWidth="920px">
        <TableHeader>
          <TableRow>
            <TableHead>Vencimento</TableHead>
            <TableHead>Recebimento</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Referente a</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.linhas.length > 0 ? (
            dados.linhas.map((linha) => (
              <TableRow key={linha.id}>
                <TableCell className="font-medium text-foreground">
                  {formatDate(linha.vencimento)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {linha.recebimento ? formatDate(linha.recebimento) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {brl.format(linha.valor)}
                  {/*
                    Só mostra o recebido quando ele DIFERE do combinado. Repetir
                    o mesmo número em duas linhas ensina a ignorar a segunda,
                    que é justamente onde mora a diferença quando existe.
                  */}
                  {linha.valorRecebido !== null &&
                  linha.valorRecebido !== linha.valor ? (
                    <span className="block text-xs">
                      recebido {brl.format(linha.valorRecebido)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <StatusMensalidadeBadge status={linha.status} />
                </TableCell>
                <TableCell>
                  <Badge tone={linha.canal === "asaas" ? "info" : "neutral"}>
                    {linha.canal === "asaas" ? "Asaas" : "Manual"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {linha.referencia}
                </TableCell>
                <TableCell>
                  <AcoesDaLinha
                    linha={linha}
                    onBaixar={() => setBaixando(linha)}
                    onEditar={() => setEditando(linha)}
                    onDesfazer={() => desfazerBaixa(linha)}
                  />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={7}>
              <p className="font-medium text-foreground">
                Nenhuma mensalidade registrada.
              </p>
              <p className="mt-1">
                {dados.semVencimento.length > 0
                  ? "Cadastre o 1º vencimento da matrícula para os meses aparecerem aqui."
                  : dados.contratos.length > 0
                    ? "Gere a cobrança do contrato para o sistema passar a acompanhar os meses."
                    : "As mensalidades aparecem aqui depois que o aluno tem matrícula ativa com valor e primeiro vencimento."}
              </p>
            </TableEmpty>
          )}
        </TableBody>
      </Table>

      <BaixaManualModal
        linha={baixando}
        onClose={() => setBaixando(null)}
        onConfirm={darBaixa}
      />

      <EditarCobrancaModal
        linha={editando}
        onClose={() => setEditando(null)}
        onConfirm={editarCobranca}
      />
    </section>
  );
}

function AcoesDaLinha({
  linha,
  onBaixar,
  onEditar,
  onDesfazer,
}: {
  linha: LinhaMensalidade;
  onBaixar: () => void;
  onEditar: () => void;
  onDesfazer: () => void;
}) {
  if (linha.canal === "asaas") {
    const quitada = linha.status === "pago";

    return (
      <div className="flex flex-wrap items-center gap-2">
        {!quitada && linha.contratoId ? (
          <FaturaBotao
            contratoId={linha.contratoId}
            paymentId={linha.paymentId ?? undefined}
            rotulo="Reenviar"
          />
        ) : null}

        {!quitada ? (
          <Button variant="outline" size="sm" onClick={onEditar} className="h-7 px-2 text-xs">
            Editar
          </Button>
        ) : linha.invoiceUrl ? (
          <a
            href={linha.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            Ver comprovante
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    );
  }

  if (linha.status === "pago") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onBaixar} className="h-7 px-2 text-xs">
          Editar baixa
        </Button>
        <Button variant="ghost" size="sm" onClick={onDesfazer} className="h-7 px-2 text-xs">
          Desfazer
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={onBaixar} className="h-7 px-2 text-xs">
      Dar baixa
    </Button>
  );
}
