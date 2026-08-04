"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AsaasSelo } from "@/components/brand/asaas-selo";
import {
  criarSubcontaEscola,
  type CriarSubcontaEscolaState,
} from "@/features/baas/subconta-actions";
import {
  consultarOnboarding,
  type OnboardingState,
} from "@/features/baas/onboarding-actions";

export type DadosEscola = {
  razaoSocial: string;
  cnpj: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  companyType: string;
  faturamento: string;
  dataNascimento: string;
};

const ETAPAS = [
  { n: 1, titulo: "Dados da escola", quem: "você preenche" },
  { n: 2, titulo: "Criar a conta", quem: "o sistema faz" },
  { n: 3, titulo: "Documentos", quem: "você envia" },
  { n: 4, titulo: "Análise", quem: "o Asaas avalia" },
] as const;

/** Campos que o Asaas exige e que travam o botão enquanto faltarem. */
const OBRIGATORIOS: Array<[keyof DadosEscola, string]> = [
  ["razaoSocial", "Razão social"],
  ["cnpj", "CNPJ"],
  ["email", "E-mail"],
  ["telefone", "Telefone"],
  ["cep", "CEP"],
  ["logradouro", "Logradouro"],
  ["numero", "Número"],
  ["bairro", "Bairro"],
  ["companyType", "Tipo de empresa"],
  ["faturamento", "Faturamento estimado"],
];

export function ContaPagamentosFluxo({
  contaCriada,
  accountId,
  kycStatus,
  ambiente,
  escola,
}: {
  contaCriada: boolean;
  accountId: string | null;
  kycStatus: string | null;
  ambiente: string;
  escola: DadosEscola;
}) {
  const [form, setForm] = useState<DadosEscola>(escola);
  const [state, formAction, criando] = useActionState<
    CriarSubcontaEscolaState,
    FormData
  >(criarSubcontaEscola, {});
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [consultando, setConsultando] = useState(false);

  const set = (campo: keyof DadosEscola) => (valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const pessoaFisica =
    form.companyType === "MEI" || form.companyType === "INDIVIDUAL";

  const faltando = OBRIGATORIOS.filter(([campo]) => !form[campo].trim()).map(
    ([, label]) => label,
  );
  if (pessoaFisica && !form.dataNascimento.trim()) {
    faltando.push("Data de nascimento");
  }

  const aprovada = (kycStatus ?? "").toLowerCase() === "aprovada";
  const recusada = (kycStatus ?? "").toLowerCase() === "recusada";

  const etapaAtual = !contaCriada ? 1 : aprovada || recusada ? 4 : 3;

  /*
   * RECONSULTA AO VOLTAR PARA A ABA.
   *
   * O envio de selfie e documento acontece FORA do portal, numa página do
   * Asaas. Quem sai, envia e volta encontrava a tela velha e concluía que não
   * tinha funcionado. Aqui a volta do foco dispara a consulta sozinha.
   *
   * Com teto de uma a cada 30 segundos: sem ele, alternar entre abas viraria
   * uma rajada de chamadas à API do provedor por causa de um comportamento
   * normal de quem está comparando duas telas.
   */
  const ultimaConsulta = useRef(0);
  const consultar = useCallback(async (forcar = false) => {
    const agora = Date.now();
    if (!forcar && agora - ultimaConsulta.current < 30_000) return;
    ultimaConsulta.current = agora;
    setConsultando(true);
    try {
      setOnboarding(await consultarOnboarding());
    } finally {
      setConsultando(false);
    }
  }, []);

  /*
   * A DOCUMENTAÇÃO DO ASAAS EXIGE ~15s ENTRE CRIAR A CONTA E LISTAR OS
   * DOCUMENTOS. Antes disso a lista de pendências vem vazia — não porque não
   * há pendência, mas porque o cadastro ainda está sendo montado do lado
   * deles.
   *
   * Não dá para saber, na montagem, se a conta nasceu agora ou ano passado.
   * Então em vez de esperar sempre, o gatilho é o SINTOMA: lista vazia com
   * conta existente é o caso suspeito, e só ele repete a consulta uma vez,
   * 15 segundos depois. Conta antiga e sem pendência responde vazio também,
   * mas paga só uma consulta a mais — e uma tela que diz "nenhuma pendência"
   * quando há duas é bem mais cara que isso.
   */
  const jaRepetiu = useRef(false);
  useEffect(() => {
    if (!contaCriada || jaRepetiu.current) return;
    if (!onboarding?.ok) return;
    if ((onboarding.documentos?.length ?? 0) > 0) return;
    jaRepetiu.current = true;
    const t = setTimeout(() => void consultar(true), 15_000);
    return () => clearTimeout(t);
  }, [contaCriada, onboarding, consultar]);

  useEffect(() => {
    if (!contaCriada) return;
    void consultar(true);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void consultar();
    };
    window.addEventListener("focus", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.removeEventListener("focus", aoVoltar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [contaCriada, consultar]);

  return (
    <div className="mt-6 space-y-4">
      <Trilha atual={etapaAtual} />

      {ambiente !== "production" ? (
        <Alert tone="info">
          Ambiente de testes. A conta criada aqui não recebe dinheiro de
          verdade.
        </Alert>
      ) : null}

      {etapaAtual === 1 ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">
            ① Dados da escola
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O Asaas exige estes campos para abrir a conta.
          </p>

          <form action={formAction} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Razão social" nome="razao_social" required
                valor={form.razaoSocial} onChange={set("razaoSocial")} />
              <Campo label="CNPJ" nome="cnpj" required
                valor={form.cnpj} onChange={set("cnpj")} />
              <Campo label="E-mail" nome="email" required type="email"
                valor={form.email} onChange={set("email")} />
              <Campo label="Telefone celular" nome="telefone" required
                valor={form.telefone} onChange={set("telefone")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <Campo label="CEP" nome="cep" required
                hint="Define a cidade no Asaas"
                valor={form.cep} onChange={set("cep")} />
              <div className="sm:col-span-2">
                <Campo label="Logradouro" nome="logradouro" required
                  valor={form.logradouro} onChange={set("logradouro")} />
              </div>
              <Campo label="Número" nome="numero" required
                valor={form.numero} onChange={set("numero")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Complemento" nome="complemento"
                valor={form.complemento} onChange={set("complemento")} />
              <Campo label="Bairro" nome="bairro" required
                valor={form.bairro} onChange={set("bairro")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tipo de empresa" required>
                <Select
                  name="company_type"
                  value={form.companyType}
                  onChange={(e) => set("companyType")(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  <option value="MEI">MEI</option>
                  <option value="LIMITED">LTDA</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="ASSOCIATION">Associação</option>
                </Select>
              </Field>

              <Campo
                label="Faturamento mensal"
                nome="faturamento"
                required
                hint="Estimativa, usada na análise do Asaas"
                valor={form.faturamento}
                onChange={set("faturamento")}
              />

              {/*
                Só para pessoa física. Mostrar sempre pediria a data de
                nascimento de uma LTDA, que não tem.
              */}
              {pessoaFisica ? (
                <Campo
                  label="Nascimento do titular"
                  nome="data_nascimento"
                  required
                  type="date"
                  hint="Exigido para MEI e Individual"
                  valor={form.dataNascimento}
                  onChange={set("dataNascimento")}
                />
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              Estes dados também atualizam o cadastro da escola.
            </p>

            {state.faltando?.length ? (
              <Alert tone="warning">
                Falta preencher: {state.faltando.join(" · ")}
              </Alert>
            ) : null}
            {state.message && !state.ok ? (
              <Alert tone="danger">{state.message}</Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={criando || faltando.length > 0}>
                {criando ? "Criando…" : "Criar conta de pagamentos"}
              </Button>
              {/*
                O motivo fica ao lado do botão travado. Botão desabilitado sem
                explicação faz a pessoa clicar de novo achando que quebrou.
              */}
              {faltando.length > 0 ? (
                <span className="text-sm text-muted-foreground">
                  {faltando.length === 1
                    ? `Falta ${faltando[0]}`
                    : `Faltam ${faltando.length} campos: ${faltando.slice(0, 3).join(", ")}${faltando.length > 3 ? "…" : ""}`}
                </span>
              ) : null}
            </div>
          </form>

          {criando ? <Criando /> : null}
        </Card>
      ) : null}

      {etapaAtual >= 3 ? (
        <Documentos
          onboarding={onboarding}
          consultando={consultando}
          aoVerificar={() => void consultar(true)}
          accountId={accountId}
          kycStatus={kycStatus}
        />
      ) : null}

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <AsaasSelo fundo="claro" tamanho="sm" />
        <p className="text-xs text-muted-foreground">
          A conta é aberta e mantida pelo Asaas, instituição de pagamento
          autorizada.
        </p>
      </div>
    </div>
  );
}

function Trilha({ atual }: { atual: number }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {ETAPAS.map((e) => {
        const feita = e.n < atual;
        const ativa = e.n === atual;
        return (
          <li
            key={e.n}
            className={`flex min-w-[150px] flex-1 items-center gap-2 rounded-lg border px-3 py-2 ${
              ativa
                ? "border-primary bg-primary/5"
                : feita
                  ? "border-border bg-muted"
                  : "border-border"
            }`}
            aria-current={ativa ? "step" : undefined}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                feita
                  ? "bg-success text-white"
                  : ativa
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {feita ? <Check className="h-3.5 w-3.5" aria-hidden /> : e.n}
            </span>
            <span className="min-w-0">
              <span
                className={`block truncate text-sm ${ativa ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                {e.titulo}
              </span>
              {/* Quem age em cada etapa: duas delas são espera, e sem dizer
                  isso a pessoa fica olhando para a tela esperando um botão. */}
              <span className="block truncate text-xs text-muted-foreground">
                {e.quem}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A espera obrigatória de 15 segundos, nomeada.
 *
 * A documentação do Asaas exige aguardar antes de checar documentos, senão a
 * lista de pendências vem errada. Esconder isso atrás de um spinner genérico
 * faz a espera parecer travamento — dizer o que está acontecendo custa o
 * mesmo e devolve a confiança.
 */
function Criando() {
  return (
    <div className="mt-5 rounded-lg border border-border bg-muted p-4">
      <p className="text-sm font-medium text-foreground">Criando a conta</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        <li>Criando a conta no Asaas</li>
        <li>Configurando o aviso de pagamento</li>
        <li className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Validando o CNPJ na Receita Federal…
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Costuma levar uns quinze segundos. Não feche a página.
      </p>
    </div>
  );
}

function Documentos({
  onboarding,
  consultando,
  aoVerificar,
  accountId,
  kycStatus,
}: {
  onboarding: OnboardingState | null;
  consultando: boolean;
  aoVerificar: () => void;
  accountId: string | null;
  kycStatus: string | null;
}) {
  const docs = onboarding?.documentos ?? [];
  const pendentes = docs.filter((d) => d.status.toUpperCase() !== "APPROVED");
  const aprovada = (kycStatus ?? "").toLowerCase() === "aprovada";
  const recusada = (kycStatus ?? "").toLowerCase() === "recusada";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {aprovada ? "④ Aprovada" : recusada ? "④ Recusada" : "③ Documentos"}
          </h2>
          {accountId ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {accountId}
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={aoVerificar} disabled={consultando}>
          {consultando ? "Verificando…" : "Verificar novamente"}
        </Button>
      </div>

      {aprovada ? (
        <Alert tone="success" className="mt-4">
          Conta aprovada. Já dá para cobrar as mensalidades pelo sistema.
        </Alert>
      ) : recusada ? (
        /* O motivo do provedor vem literal. Sem ele a pessoa abre chamado —
           e a plataforma vira o suporte do Asaas. */
        <Alert tone="danger" className="mt-4">
          {onboarding?.message ?? "O Asaas recusou o cadastro."}
        </Alert>
      ) : pendentes.length === 0 && docs.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
          Documentos enviados. O Asaas está analisando — você é avisado aqui
          quando sair o resultado.{" "}
          <strong className="font-medium text-foreground">
            Não há nada a fazer agora.
          </strong>
        </div>
      ) : (
        <>
          {/* A explicação vem ANTES dos botões: link para fora sem aviso
              parece erro ou golpe, ainda mais num fluxo que pede selfie. */}
          <p className="mt-4 text-sm text-muted-foreground">
            A selfie e o documento de identificação são enviados numa página do
            Asaas. É exigência do Banco Central — o Asaas é a instituição
            responsável pela conta. Você volta para cá quando terminar.
          </p>

          <ul className="mt-4 space-y-2">
            {docs.map((d) => {
              const ok = d.status.toUpperCase() === "APPROVED";
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    {ok ? (
                      <Check className="h-4 w-4 text-success-text" aria-hidden />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden />
                    )}
                    {d.title}
                  </span>
                  {ok ? (
                    <span className="text-xs text-muted-foreground">enviado</span>
                  ) : d.onboardingUrl ? (
                    /* Documento com onboardingUrl SÓ sai por link — a API
                       recusa upload desses. */
                    <a
                      href={d.onboardingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      Enviar no Asaas
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      envio pelo portal — em breve
                    </span>
                  )}
                </li>
              );
            })}
            {docs.length === 0 && !consultando ? (
              <li className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
                {onboarding?.message ?? "Nenhuma pendência listada."}
              </li>
            ) : null}
          </ul>
        </>
      )}
    </Card>
  );
}

function Campo({
  label,
  nome,
  valor,
  onChange,
  required,
  hint,
  type = "text",
}: {
  label: string;
  nome: string;
  valor: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
  type?: string;
}) {
  return (
    <Field label={label} required={required} hint={hint}>
      <Input
        name={nome}
        type={type}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
