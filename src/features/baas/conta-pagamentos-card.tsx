"use client";

import { useActionState, useState, useTransition } from "react";
import {
  criarSubcontaEscola,
  type CriarSubcontaEscolaState,
} from "@/features/baas/subconta-actions";
import {
  consultarOnboarding,
  type OnboardingState,
} from "@/features/baas/onboarding-actions";
import { AsaasSelo } from "@/components/brand/asaas-selo";

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

  function verificarCadastro() {
    startConsulta(async () => {
      setOnboarding(await consultarOnboarding());
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
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
              <button
                type="button"
                onClick={verificarCadastro}
                disabled={consultando}
                className="h-9 rounded-md border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
              >
                {consultando ? "Consultando…" : "Verificar pendências"}
              </button>
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
                    {d.onboardingUrl ? (
                      <a
                        href={d.onboardingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 rounded-md bg-foreground px-3 text-xs font-medium leading-8 text-white transition hover:opacity-90"
                      >
                        Enviar documentos
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Envio pelo suporte
                      </span>
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
            <input
              name="faturamento"
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="0,00"
              className="mt-1 h-9 w-48 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-foreground">Tipo de empresa</span>
            <select
              name="company_type"
              required
              defaultValue=""
              className="mt-1 h-9 w-48 rounded-md border border-border bg-white px-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Selecione…</option>
              <option value="MEI">MEI</option>
              <option value="LIMITED">Ltda</option>
              <option value="INDIVIDUAL">Empresário individual</option>
              <option value="ASSOCIATION">Associação</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Criando…" : "Criar conta de pagamentos"}
          </button>
        </form>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <AsaasSelo variant="azul" />
      </div>
    </div>
  );
}
