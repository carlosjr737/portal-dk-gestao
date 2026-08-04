"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Check, Clock, ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  criarSubcontaEscola,
  type CriarSubcontaEscolaState,
} from "@/features/baas/subconta-actions";
import {
  consultarOnboarding,
  type OnboardingState,
} from "@/features/baas/onboarding-actions";
import { consultarCnpj } from "@/features/baas/cnpj-actions";
import { useRouter } from "next/navigation";

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

/*
 * Tempo de cada etapa. Só entra estimativa que é verdade:
 *
 *   15 segundos   espera obrigatória da API, documentada.
 *   3 minutos     tirar foto do documento e uma selfie.
 *   1 dia útil    análise humana — ESTE precisa ser confirmado com o gerente
 *                 de contas antes de produção. Prometer cinco minutos e levar
 *                 um dia é pior do que não prometer nada.
 */
const BLOCOS = [
  {
    n: 1,
    titulo: "Dados da escola",
    tempo: null,
    previa: "CNPJ, endereço e tipo de empresa. O CNPJ preenche o resto.",
  },
  {
    n: 2,
    titulo: "Criar a conta",
    tempo: "cerca de 15 segundos",
    previa:
      "Automático. Criamos a conta, configuramos os avisos e o Asaas valida o CNPJ na Receita.",
  },
  {
    n: 3,
    titulo: "Enviar documentos",
    tempo: "cerca de 3 minutos",
    previa:
      "Você vai precisar de: RG ou CNH do responsável e uma selfie. O envio acontece numa página do Asaas.",
  },
  {
    n: 4,
    titulo: "Análise do Asaas",
    tempo: "até 1 dia útil",
    previa:
      "Nós avisamos aqui quando sair o resultado. Você não faz nada nessa etapa.",
  },
] as const;

const OBRIGATORIOS: Array<[keyof DadosEscola, string]> = [
  ["cnpj", "CNPJ"],
  ["razaoSocial", "Razão social"],
  ["email", "E-mail"],
  ["telefone", "Telefone"],
  ["cep", "CEP"],
  ["logradouro", "Logradouro"],
  ["numero", "Número"],
  ["bairro", "Bairro"],
  ["companyType", "Tipo de empresa"],
  ["faturamento", "Faturamento estimado"],
];

const TIPOS = [
  { valor: "MEI", label: "MEI" },
  { valor: "LIMITED", label: "LTDA" },
  { valor: "INDIVIDUAL", label: "Individual" },
  { valor: "ASSOCIATION", label: "Associação" },
] as const;

// ── máscaras ────────────────────────────────────────────────────────────────
// Formatam enquanto digita. O valor vai mascarado para o servidor, que já
// normaliza com `soDigitos` antes de mandar ao provedor — mascarar aqui e
// limpar lá evita que a pessoa veja o próprio CNPJ sem pontuação.

const mascaraCnpj = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

const mascaraCep = (v: string) =>
  v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

const mascaraTelefone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

const mascaraDinheiro = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  return (Number(d) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

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
  const [form, setForm] = useState<DadosEscola>({
    ...escola,
    cnpj: escola.cnpj ? mascaraCnpj(escola.cnpj) : "",
    cep: escola.cep ? mascaraCep(escola.cep) : "",
    telefone: escola.telefone ? mascaraTelefone(escola.telefone) : "",
    faturamento: escola.faturamento
      ? mascaraDinheiro(String(Math.round(Number(escola.faturamento) * 100)))
      : "",
  });
  const [state, formAction, criando] = useActionState<
    CriarSubcontaEscolaState,
    FormData
  >(criarSubcontaEscola, {});
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [buscandoCnpj, startBusca] = useTransition();
  const [erroCnpj, setErroCnpj] = useState<string | null>(null);
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState(false);

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
  const revogada = (kycStatus ?? "").toLowerCase() === "revogada";
  const finalizada = aprovada || recusada || revogada;

  const atual = !contaCriada || editando ? 1 : finalizada ? 4 : 3;

  /*
   * CNPJ PREENCHE O RESTO. A pessoa confere, não digita.
   *
   * Só preenche campo VAZIO: quem já corrigiu o endereço à mão não pode ver a
   * correção ser desfeita por uma consulta que rodou depois. A busca é
   * conveniência, não autoridade.
   */
  const buscarCnpj = useCallback(
    (valor: string) => {
      const digitos = valor.replace(/\D/g, "");
      if (digitos.length !== 14) return;
      setErroCnpj(null);
      startBusca(async () => {
        const r = await consultarCnpj(digitos);
        if (!r.ok) {
          setErroCnpj(r.message);
          return;
        }
        setForm((f) => ({
          ...f,
          razaoSocial: f.razaoSocial || r.razaoSocial,
          email: f.email || r.email || "",
          telefone: f.telefone || (r.telefone ? mascaraTelefone(r.telefone) : ""),
          cep: f.cep || (r.cep ? mascaraCep(r.cep) : ""),
          logradouro: f.logradouro || r.logradouro || "",
          numero: f.numero || r.numero || "",
          complemento: f.complemento || r.complemento || "",
          bairro: f.bairro || r.bairro || "",
          companyType: f.companyType || r.companyType || "",
        }));
      });
    },
    [],
  );

  const router = useRouter();
  const ultimaConsulta = useRef(0);
  const consultar = useCallback(
    async (forcar = false) => {
      const agora = Date.now();
      if (!forcar && agora - ultimaConsulta.current < 30_000) return;
      ultimaConsulta.current = agora;
      setConsultando(true);
      try {
        const r = await consultarOnboarding();
        setOnboarding(r);
        /*
         * Conta apagada: a action removeu o registro do banco, mas as props
         * desta tela vieram do servidor no carregamento e não sabem disso.
         * Sem o refresh, o bloco 4 mostraria "não existe mais" e o bloco 1
         * seguiria colapsado como "Concluído" — sem caminho para criar outra.
         */
        if (r.statusGeral === "REVOKED") router.refresh();
      } finally {
        setConsultando(false);
      }
    },
    [router],
  );

  /*
   * A doc do Asaas exige ~15s entre criar a conta e listar documentos; antes
   * disso a lista vem vazia. Como não dá para saber, na montagem, se a conta
   * nasceu agora, o gatilho é o sintoma: lista vazia com conta existente
   * repete uma vez, 15s depois.
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

  /* O envio de documento acontece FORA do portal. Quem sai, envia e volta
     encontrava a tela velha e concluía que não funcionou. */
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

  const situacao = !contaCriada
    ? { texto: "Não iniciada", tom: "neutral" as const }
    : aprovada
      ? { texto: "Aprovada", tom: "success" as const }
      : recusada || revogada
        ? { texto: revogada ? "Não existe mais" : "Recusada", tom: "danger" as const }
        : { texto: "Em andamento", tom: "warning" as const };

  return (
    <div className="mt-6 space-y-3">
      <div className="flex justify-end">
        <Badge tone={situacao.tom}>{situacao.texto}</Badge>
      </div>

      {/*
        "TENHA EM MÃOS" ANTES DO PRIMEIRO CAMPO.
        A etapa 3 é a única que exige preparo, e descobrir isso no meio do
        caminho é o que faz a pessoa abandonar com a conta pela metade.
      */}
      {!contaCriada ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-4 py-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">
              Leva cerca de 5 minutos.
            </strong>{" "}
            Tenha em mãos o CNPJ e o RG ou CNH do responsável pela escola.
          </p>
        </div>
      ) : null}

      {ambiente !== "production" ? (
        <Alert tone="info">
          Ambiente de testes. A conta criada aqui não recebe dinheiro de verdade.
        </Alert>
      ) : null}

      {BLOCOS.map((b) => {
        const concluido = b.n < atual;
        const ativo = b.n === atual;

        /*
           * O conteúdo sai calculado, e não como quatro expressões irmãs
           * dentro do JSX. Como irmãs, `children` virava um ARRAY de nulls —
           * que é truthy — e o bloco concluído desenhava uma caixa vazia de
           * corpo. É o buraco branco que apareceu embaixo de "Concluído".
           */
          const conteudo =
            b.n === 1 && ativo ? (
              <FormularioDados
                form={form}
                set={set}
                pessoaFisica={pessoaFisica}
                faltando={faltando}
                criando={criando}
                formAction={formAction}
                state={state}
                buscarCnpj={buscarCnpj}
                buscandoCnpj={buscandoCnpj}
                erroCnpj={erroCnpj}
                tocados={tocados}
                marcarTocado={(c) => setTocados((s) => new Set(s).add(c))}
              />
            ) : b.n === 2 && criando ? (
              <Criando />
            ) : b.n === 3 && ativo ? (
              <Documentos
                onboarding={onboarding}
                consultando={consultando}
                aoVerificar={() => void consultar(true)}
              />
            ) : b.n === 4 && ativo ? (
              <Resultado
                aprovada={aprovada}
                recusada={recusada}
                revogada={revogada}
                onboarding={onboarding}
                accountId={accountId}
                consultando={consultando}
                aoVerificar={() => void consultar(true)}
              />
            ) : null;

          return (
            <Bloco
              key={b.n}
              numero={b.n}
              titulo={b.titulo}
              tempo={b.tempo}
              estado={concluido ? "concluido" : ativo ? "atual" : "futuro"}
              previa={b.previa}
              aoEditar={
                b.n === 1 && concluido && !finalizada
                  ? () => setEditando(true)
                  : undefined
              }
            >
              {conteudo}
            </Bloco>
          );
      })}

      {/*
        Rodapé regulatório, com a razão social completa. A Resolução Conjunta
        16 exige evidenciar a instituição prestadora em cada ponto de contato —
        e este fluxo é onde a conta nasce.
      */}
      <p className="pt-2 text-center text-xs text-muted-foreground">
        Serviços de pagamento prestados por
        <br />
        Asaas Gestão Financeira Instituição de Pagamento S.A.
      </p>
    </div>
  );
}

function Bloco({
  numero,
  titulo,
  tempo,
  estado,
  previa,
  aoEditar,
  children,
}: {
  numero: number;
  titulo: string;
  tempo: string | null;
  estado: "concluido" | "atual" | "futuro";
  previa: string;
  aoEditar?: () => void;
  children?: React.ReactNode;
}) {
  const atual = estado === "atual";

  return (
    <Card
      className={`overflow-hidden p-0 ${atual ? "border-2 border-primary" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              estado === "concluido"
                ? "bg-success text-white"
                : atual
                  ? "bg-primary text-white"
                  : "border border-input text-muted-foreground"
            }`}
          >
            {estado === "concluido" ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              numero
            )}
          </span>
          <span
            className={`text-sm font-semibold ${atual || estado === "concluido" ? "text-foreground" : "text-muted-foreground"}`}
          >
            {titulo}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {estado === "concluido" ? (
            <>
              <Badge tone="success">Concluído</Badge>
              {aoEditar ? (
                <button
                  type="button"
                  onClick={aoEditar}
                  className="rounded text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Editar
                </button>
              ) : null}
            </>
          ) : atual ? (
            <Badge tone="info">Você está aqui</Badge>
          ) : tempo ? (
            <span className="text-xs text-muted-foreground">{tempo}</span>
          ) : null}
        </div>
      </div>

      {/*
        A prévia é o que responde "e depois?" sem a pessoa precisar avançar
        para descobrir. Bloco futuro sem ela é uma caixa fechada que não
        informa nada.
      */}
      {estado === "futuro" ? (
        <p className="border-t border-border bg-muted/40 px-5 py-3 text-sm text-muted-foreground">
          {previa}
        </p>
      ) : null}

      {children ? (
        <div className="border-t border-border px-5 py-5">{children}</div>
      ) : null}
    </Card>
  );
}

function FormularioDados({
  form,
  set,
  pessoaFisica,
  faltando,
  criando,
  formAction,
  state,
  buscarCnpj,
  buscandoCnpj,
  erroCnpj,
  tocados,
  marcarTocado,
}: {
  form: DadosEscola;
  set: (c: keyof DadosEscola) => (v: string) => void;
  pessoaFisica: boolean;
  faltando: string[];
  criando: boolean;
  formAction: (fd: FormData) => void;
  state: CriarSubcontaEscolaState;
  buscarCnpj: (v: string) => void;
  buscandoCnpj: boolean;
  erroCnpj: string | null;
  tocados: Set<string>;
  marcarTocado: (c: string) => void;
}) {
  /** Erro embaixo do campo, e só depois de sair dele. */
  const erro = (campo: keyof DadosEscola, label: string) =>
    tocados.has(campo) && !form[campo].trim() ? `Preencha o ${label}` : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="CNPJ"
          nome="cnpj"
          required
          inputMode="numeric"
          valor={form.cnpj}
          onChange={(v) => set("cnpj")(mascaraCnpj(v))}
          onBlur={() => {
            marcarTocado("cnpj");
            buscarCnpj(form.cnpj);
          }}
          hint={
            buscandoCnpj
              ? "Buscando na Receita…"
              : "Preenchemos o resto com os dados da Receita."
          }
          erro={erroCnpj ?? erro("cnpj", "CNPJ")}
        />
        <Campo
          label="Razão social"
          nome="razao_social"
          required
          carregando={buscandoCnpj}
          valor={form.razaoSocial}
          onChange={set("razaoSocial")}
          onBlur={() => marcarTocado("razaoSocial")}
          erro={erro("razaoSocial", "razão social")}
        />
        <Campo
          label="E-mail"
          nome="email"
          required
          type="email"
          carregando={buscandoCnpj}
          valor={form.email}
          onChange={set("email")}
          onBlur={() => marcarTocado("email")}
          erro={erro("email", "e-mail")}
        />
        <Campo
          label="Telefone celular"
          nome="telefone"
          required
          inputMode="numeric"
          carregando={buscandoCnpj}
          valor={form.telefone}
          onChange={(v) => set("telefone")(mascaraTelefone(v))}
          onBlur={() => marcarTocado("telefone")}
          erro={erro("telefone", "telefone")}
        />
        <Campo
          label="CEP"
          nome="cep"
          required
          inputMode="numeric"
          carregando={buscandoCnpj}
          hint="Define a cidade no Asaas"
          valor={form.cep}
          onChange={(v) => set("cep")(mascaraCep(v))}
          onBlur={() => marcarTocado("cep")}
          erro={erro("cep", "CEP")}
        />
        <Campo
          label="Logradouro"
          nome="logradouro"
          required
          carregando={buscandoCnpj}
          valor={form.logradouro}
          onChange={set("logradouro")}
          onBlur={() => marcarTocado("logradouro")}
          erro={erro("logradouro", "logradouro")}
        />
        <Campo
          label="Número"
          nome="numero"
          required
          carregando={buscandoCnpj}
          valor={form.numero}
          onChange={set("numero")}
          onBlur={() => marcarTocado("numero")}
          erro={erro("numero", "número")}
        />
        <Campo
          label="Bairro"
          nome="bairro"
          required
          carregando={buscandoCnpj}
          valor={form.bairro}
          onChange={set("bairro")}
          onBlur={() => marcarTocado("bairro")}
          erro={erro("bairro", "bairro")}
        />
        <Campo
          label="Complemento"
          nome="complemento"
          valor={form.complemento}
          onChange={set("complemento")}
        />
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">
          Tipo de empresa <span className="text-danger-text">*</span>
        </p>
        {/*
          Botões e não select: são quatro opções curtas, e a escolha muda o
          formulário (pessoa física ganha data de nascimento). Ver as quatro de
          uma vez explica a consequência antes do clique.
        */}
        <div className="mt-2 flex flex-wrap gap-2" role="group">
          {TIPOS.map((t) => {
            const escolhido = form.companyType === t.valor;
            return (
              <button
                key={t.valor}
                type="button"
                onClick={() => set("companyType")(t.valor)}
                aria-pressed={escolhido}
                className={`h-11 rounded-md border px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  escolhido
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="company_type" value={form.companyType} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Faturamento mensal estimado"
          nome="faturamento"
          required
          inputMode="numeric"
          hint="O Asaas usa isso na análise."
          valor={form.faturamento}
          onChange={(v) => set("faturamento")(mascaraDinheiro(v))}
          onBlur={() => marcarTocado("faturamento")}
          erro={erro("faturamento", "faturamento")}
        />
        {pessoaFisica ? (
          <Campo
            label="Nascimento do titular"
            nome="data_nascimento"
            required
            type="date"
            hint="Exigido para MEI e Individual"
            valor={form.dataNascimento}
            onChange={set("dataNascimento")}
            onBlur={() => marcarTocado("dataNascimento")}
            erro={erro("dataNascimento", "data de nascimento")}
          />
        ) : null}
      </div>

      {state.faltando?.length ? (
        <Alert tone="warning">Falta preencher: {state.faltando.join(" · ")}</Alert>
      ) : null}
      {state.message && !state.ok ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={criando || faltando.length > 0}
            className="h-11"
          >
            {criando ? "Criando…" : "Criar conta e continuar"}
          </Button>
          {faltando.length > 0 ? (
            <span className="flex items-center gap-1.5 text-sm text-warning-text">
              <TriangleAlert className="h-4 w-4" aria-hidden />
              {faltando.length === 1
                ? "Falta 1 campo"
                : `Faltam ${faltando.length} campos`}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          Salvo automaticamente no cadastro da escola
        </span>
      </div>
    </form>
  );
}

function Criando() {
  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      <li>Criando a conta no Asaas</li>
      <li>Configurando o aviso de pagamento</li>
      <li className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Validando o CNPJ na Receita Federal…
      </li>
      <li className="pt-1 text-xs">Não feche a página.</li>
    </ul>
  );
}

function Documentos({
  onboarding,
  consultando,
  aoVerificar,
}: {
  onboarding: OnboardingState | null;
  consultando: boolean;
  aoVerificar: () => void;
}) {
  const docs = onboarding?.documentos ?? [];

  return (
    <div>
      {/* A explicação vem ANTES dos botões: link para fora sem aviso parece
          golpe, ainda mais num fluxo que pede selfie. */}
      <p className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        A selfie e o documento são enviados numa página do{" "}
        <strong className="font-medium text-foreground">Asaas</strong>, que é a
        instituição responsável pela conta. É exigência do Banco Central. A aba
        abre ao lado e esta página atualiza sozinha quando você voltar.
      </p>

      <ul className="mt-4 space-y-2">
        {docs.map((d) => {
          const ok = d.status.toUpperCase() === "APPROVED";
          return (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
            >
              <span className="flex items-center gap-2.5 text-sm text-foreground">
                {ok ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success">
                    <Check className="h-3 w-3 text-white" aria-hidden />
                  </span>
                ) : (
                  <span
                    className="h-5 w-5 rounded-full border border-input"
                    aria-hidden
                  />
                )}
                <span>
                  {d.title}
                  {ok ? (
                    <span className="block text-xs text-muted-foreground">
                      enviado
                    </span>
                  ) : null}
                </span>
              </span>
              {!ok && d.onboardingUrl ? (
                <a
                  href={d.onboardingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-1.5 rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Abrir no Asaas
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : !ok ? (
                <span className="text-xs text-muted-foreground">
                  envio pelo portal — em breve
                </span>
              ) : null}
            </li>
          );
        })}
        {docs.length === 0 ? (
          <li className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
            {consultando
              ? "Consultando o Asaas…"
              : (onboarding?.message ?? "Nenhuma pendência listada.")}
          </li>
        ) : null}
      </ul>

      <p className="mt-3 text-sm text-muted-foreground">
        Nada enviado ainda? A página verifica sozinha a cada volta.{" "}
        <button
          type="button"
          onClick={aoVerificar}
          disabled={consultando}
          className="rounded font-medium text-primary hover:underline disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {consultando ? "Verificando…" : "Verificar agora"}
        </button>
      </p>
    </div>
  );
}

function Resultado({
  aprovada,
  recusada,
  revogada,
  onboarding,
  accountId,
  consultando,
  aoVerificar,
}: {
  aprovada: boolean;
  recusada: boolean;
  revogada: boolean;
  onboarding: OnboardingState | null;
  accountId: string | null;
  consultando: boolean;
  aoVerificar: () => void;
}) {
  return (
    <div>
      {revogada ? (
        /* Estado terminal e sem conserto pela tela. Oferecer "criar outra"
           aqui convidaria a criar uma segunda subconta REAL por engano. */
        <Alert tone="danger">
          {onboarding?.message ??
            "O Asaas não reconhece mais esta conta — ela foi apagada ou a chave foi revogada."}
        </Alert>
      ) : aprovada ? (
        <Alert tone="success">
          Conta aprovada. Já dá para cobrar as mensalidades pelo sistema.
        </Alert>
      ) : recusada ? (
        /* O motivo do provedor vem literal. Sem ele a pessoa abre chamado, e a
           plataforma vira o suporte do Asaas. */
        <Alert tone="danger">
          {onboarding?.message ?? "O Asaas recusou o cadastro."}
        </Alert>
      ) : (
        <p className="text-sm text-muted-foreground">
          Documentos enviados. O Asaas está analisando — você é avisado aqui
          quando sair o resultado.{" "}
          <strong className="font-medium text-foreground">
            Não há nada a fazer agora.
          </strong>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {accountId ? (
          <span className="font-mono text-xs text-muted-foreground">
            {accountId}
          </span>
        ) : (
          <span />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={aoVerificar}
          disabled={consultando}
        >
          {consultando ? "Verificando…" : "Verificar novamente"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Campo do formulário.
 *
 * 44px de altura, e não os 40px do resto da plataforma: este é o único fluxo
 * que alguém preenche do celular segurando o aparelho com uma mão.
 */
function Campo({
  label,
  nome,
  valor,
  onChange,
  onBlur,
  required,
  hint,
  erro,
  type = "text",
  inputMode,
  carregando,
}: {
  label: string;
  nome: string;
  valor: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  required?: boolean;
  hint?: string;
  erro?: string;
  type?: string;
  inputMode?: "numeric" | "text";
  carregando?: boolean;
}) {
  const id = `campo-${nome}`;
  const ajudaId = `${id}-ajuda`;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-danger-text"> *</span> : null}
      </label>

      {/* Skeleton enquanto a Receita responde: campo em branco durante a busca
          parece travado, e a pessoa começa a digitar por cima. */}
      {carregando && !valor ? (
        <div className="mt-1.5 h-11 animate-pulse rounded-md bg-muted" />
      ) : (
        <input
          id={id}
          name={nome}
          type={type}
          inputMode={inputMode}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={erro ? true : undefined}
          aria-describedby={hint || erro ? ajudaId : undefined}
          className={`mt-1.5 h-11 w-full rounded-md border bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            erro ? "border-danger" : "border-input"
          }`}
        />
      )}

      {erro ? (
        <p id={ajudaId} className="mt-1 flex items-center gap-1 text-xs text-danger-text">
          <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
          {erro}
        </p>
      ) : hint ? (
        <p id={ajudaId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
