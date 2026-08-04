"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import {
  criarSubcontaEscola,
  type CriarSubcontaEscolaState,
} from "@/features/baas/subconta-actions";
import {
  consultarOnboarding,
  enviarDocumento,
  type EnvioDocumentoState,
  type OnboardingState,
} from "@/features/baas/onboarding-actions";
import { AsaasSelo } from "@/components/brand/asaas-selo";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const initial: CriarSubcontaEscolaState = {};

const STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  pendente: { texto: "Não criada", classe: "bg-muted text-muted-foreground" },
  analise: { texto: "Em análise", classe: "bg-amber-100 text-amber-800" },
  aprovada: { texto: "Aprovada", classe: "bg-emerald-100 text-emerald-800" },
  recusada: { texto: "Recusada", classe: "bg-rose-100 text-rose-800" },
};

export function ContaPagamentosCard({
  kycStatus,
  accountId,
  walletId,
  ambiente,
}: {
  kycStatus: string | null;
  accountId: string | null;
  walletId: string | null;
  ambiente: string;
}) {
  const [state, formAction, pending] = useActionState(criarSubcontaEscola, initial);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [consultando, startConsulta] = useTransition();
  const status = STATUS_LABEL[kycStatus ?? "pendente"] ?? STATUS_LABEL.pendente;
  const jaCriada = Boolean(accountId);

  // `useCallback` porque isto vai como prop para cada linha de documento e é
  // dependência de efeito lá dentro — recriar a cada render reconsultaria o
  // Asaas em loop.
  const verificarCadastro = useCallback(() => {
    startConsulta(async () => {
      setOnboarding(await consultarOnboarding());
    });
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Conta de pagamentos{" "}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              (opcional)
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Necessária só se a escola quiser <strong>cobrar os alunos pelo
            sistema</strong>. Sem ela, o portal segue funcionando para a gestão
            (alunos, turmas, chamada) e a cobrança continua sendo feita por
            fora. O dinheiro das mensalidades cai direto nesta conta.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.classe}`}
        >
          {status.texto}
        </span>
      </div>

      {ambiente !== "production" ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Ambiente de <strong>testes</strong>. Nenhum dinheiro real é movimentado.
        </p>
      ) : null}

      {state.message ? (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            state.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
          {state.faltando?.length ? (
            <ul className="mt-1 list-inside list-disc text-xs">
              {state.faltando.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {jaCriada ? (
        <>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Identificador da conta</dt>
              <dd className="font-mono text-xs text-foreground">{accountId}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Carteira (split)</dt>
              <dd className="font-mono text-xs text-foreground">{walletId ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Envio de documentos
                </h3>
                <p className="text-xs text-muted-foreground">
                  Necessário para liberar os recebimentos.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={verificarCadastro}
                disabled={consultando}
              >
                {consultando ? "Consultando…" : "Verificar pendências"}
              </Button>
            </div>

            {onboarding?.message ? (
              <p
                className={`mt-3 rounded-md px-3 py-2 text-sm ${
                  onboarding.ok
                    ? "bg-muted text-foreground"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {onboarding.message}
              </p>
            ) : null}

            {onboarding?.ok && onboarding.etapas ? (
              <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-3">
                {onboarding.etapas.map((e) => (
                  <li key={e.nome} className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        e.status.toUpperCase() === "APPROVED"
                          ? "bg-emerald-500"
                          : e.status.toUpperCase() === "REJECTED"
                            ? "bg-rose-500"
                            : "bg-amber-400"
                      }`}
                    />
                    <span className="text-muted-foreground">{e.nome}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {onboarding?.documentos?.length ? (
              <ul className="mt-3 space-y-2">
                {onboarding.documentos.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.status}</p>
                    </div>
                    {/*
                      O `onboardingUrl` decide o caminho, não uma escolha
                      nossa: com ele, a API recusa upload e o envio é pelo
                      link; sem ele, é por API. Subconta white label não tem
                      painel, então o segundo caso é o único que a escola tem
                      — e era justamente o que a tela mandava para o suporte.
                    */}
                    {d.onboardingUrl ? (
                      <a
                        href={d.onboardingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 rounded-md bg-foreground px-3 text-xs font-medium leading-8 text-white transition hover:opacity-90"
                      >
                        Enviar documentos
                      </a>
                    ) : d.status.toUpperCase() === "APPROVED" ? (
                      <span className="text-xs text-success-text">Aprovado</span>
                    ) : (
                      <EnvioDeDocumento
                        documentId={d.id}
                        type={d.type}
                        onEnviado={verificarCadastro}
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : (
        <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-foreground">
              Faturamento mensal estimado
            </span>
            <Input
              name="faturamento"
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="0,00"
              className="mt-1 h-9 w-48"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-foreground">Tipo de empresa</span>
            <Select
              name="company_type"
              required
              defaultValue=""
              className="mt-1 h-9 w-48 px-2"
            >
              <option value="">Selecione…</option>
              <option value="MEI">MEI</option>
              <option value="LIMITED">Ltda</option>
              <option value="INDIVIDUAL">Empresário individual</option>
              <option value="ASSOCIATION">Associação</option>
            </Select>
          </label>
          <Button
            variant="secondary"
            size="sm"
            type="submit"
            disabled={pending}
          >
            {pending ? "Criando…" : "Criar conta de pagamentos"}
          </Button>
        </form>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <AsaasSelo fundo="claro" tamanho="md" />
      </div>
    </div>
  );
}

/**
 * Upload de um documento pendente do KYC.
 *
 * Um formulário por documento porque cada um tem seu id e seu type — o Asaas
 * não aceita um envio genérico, ele responde a uma pendência específica.
 */
function EnvioDeDocumento({
  documentId,
  type,
  onEnviado,
}: {
  documentId: string;
  type: string;
  onEnviado: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    EnvioDocumentoState,
    FormData
  >(enviarDocumento, {});
  const [arquivo, setArquivo] = useState<string | null>(null);

  // Depois de enviar, relê a lista: o status sai de NOT_SENT e o item some
  // das pendências sem a pessoa precisar clicar em "Verificar" de novo.
  useEffect(() => {
    if (state.ok) onEnviado();
  }, [state.ok, onEnviado]);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="document_id" value={documentId} />
      <input type="hidden" name="type" value={type} />

      <label className="cursor-pointer rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted">
        {arquivo ?? "Escolher arquivo"}
        <input
          type="file"
          name="documento"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(event) =>
            setArquivo(event.target.files?.[0]?.name ?? null)
          }
        />
      </label>

      <Button type="submit" size="sm" disabled={pending || !arquivo}>
        {pending ? "Enviando…" : "Enviar"}
      </Button>

      {state.message ? (
        <span
          className={`w-full text-xs ${state.ok ? "text-success-text" : "text-danger-text"}`}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
