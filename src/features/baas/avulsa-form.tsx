"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  buscarPagadores,
  criarAvulsa,
  type AvulsaState,
  type Pagador,
} from "@/features/baas/avulsa-actions";

/** Mostra só o miolo do documento — o suficiente para separar homônimos. */
const mascararDoc = (d: string) => {
  const n = d.replace(/\D/g, "");
  if (n.length === 11) return `•••.${n.slice(3, 6)}.${n.slice(6, 9)}-••`;
  if (n.length === 14) return `••.${n.slice(2, 5)}.${n.slice(5, 8)}/••••-••`;
  return d;
};

const mascaraDinheiro = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  return (Number(d) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

/**
 * Cobrança avulsa — uma cobrança só, fora da mensalidade.
 *
 * O caminho principal é vir de uma cobrança estornada, e por isso o
 * formulário chega preenchido: quem estornou não deve redigitar nada.
 *
 * NENHUMA MATRÍCULA É CRIADA OU ALTERADA aqui. É uma cobrança solta — o que
 * separa isto da mensalidade, que se repete todo mês.
 */
export function AvulsaForm({
  inicial,
  taxa,
}: {
  inicial: {
    nomeSugerido: string;
    valor: string;
    descricao: string;
    vencimento: string;
  };
  taxa: number | null;
}) {
  const [state, formAction, enviando] = useActionState<AvulsaState, FormData>(
    criarAvulsa,
    {},
  );
  const [valor, setValor] = useState(inicial.valor);
  const [forma, setForma] = useState<"BOLETO" | "PIX">("BOLETO");
  const [copiado, setCopiado] = useState<string | null>(null);

  // ── quem paga ──────────────────────────────────────────────────────
  const [termo, setTermo] = useState(inicial.nomeSugerido);
  const [resultados, setResultados] = useState<Pagador[]>([]);
  const [escolhido, setEscolhido] = useState<Pagador | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const digitacao = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Busca a cada tecla, com uma pausa antes de sair chamando.
   *
   * Sem a pausa, digitar "Julia" dispara cinco buscas e a última a voltar
   * ganha — que nem sempre é a da palavra inteira. Com ela, uma busca por
   * palavra digitada.
   */
  useEffect(() => {
    if (escolhido || cadastrando) return;
    if (digitacao.current) clearTimeout(digitacao.current);

    digitacao.current = setTimeout(async () => {
      setBuscando(true);
      try {
        setResultados(await buscarPagadores(termo));
      } finally {
        setBuscando(false);
      }
    }, 300);

    return () => {
      if (digitacao.current) clearTimeout(digitacao.current);
    };
  }, [termo, escolhido, cadastrando]);

  const dinheiro = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const bruto =
    Number(
      valor
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", "."),
    ) || 0;
  const liquido = taxa !== null && bruto > 0 ? bruto - taxa : null;

  const copiar = async (texto: string, qual: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(qual);
    setTimeout(() => setCopiado(null), 2000);
  };

  // ── criada: a tela vira entrega ──────────────────────────────────────
  if (state.ok && state.cobranca) {
    const c = state.cobranca;
    const venc = c.vencimento.split("-").reverse().join("/");
    const mensagem =
      `Olá, ${c.pagador.split(" ")[0]}! Segue a cobrança de ${c.descricao}, ` +
      `no valor de ${dinheiro(c.valor)}, com vencimento em ${venc}.\n\n` +
      `${c.invoiceUrl}`;

    const telefone = (c.telefone ?? "").replace(/\D/g, "");
    const whatsapp = `https://wa.me/${telefone.length >= 10 ? `55${telefone}` : ""}?text=${encodeURIComponent(mensagem)}`;

    return (
      <div className="mt-6 space-y-4">
        <Alert tone="success">
          Cobrança de {dinheiro(c.valor)} criada para {c.pagador}, com
          vencimento em {venc}.
        </Alert>

        {/*
          O provedor não notifica ninguém — cada envio dele é cobrado. Se a
          tela não disser isso, a escola cria a cobrança e vai embora achando
          que a família foi avisada.
        */}
        <Alert tone="warning">
          <strong className="font-semibold">Ninguém foi avisado ainda.</strong>{" "}
          Você entrega o link.
        </Alert>

        <Card className="space-y-3 p-5">
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Enviar no WhatsApp
          </a>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2"
              onClick={() => copiar(c.invoiceUrl, "link")}
            >
              {copiado === "link" ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copiado === "link" ? "Link copiado" : "Copiar link"}
            </Button>

            {c.pixCopiaECola ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2"
                onClick={() => copiar(c.pixCopiaECola!, "pix")}
              >
                {copiado === "pix" ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copiado === "pix" ? "Pix copiado" : "Copiar Pix"}
              </Button>
            ) : null}
          </div>

          <a
            href={c.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Ver a fatura
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            O pagamento aparece sozinho no extrato e na conciliação. Você não
            precisa dar baixa.
          </p>
        </Card>
      </div>
    );
  }

  // ── formulário ───────────────────────────────────────────────────────
  return (
    <form action={formAction} className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="space-y-4 p-6">
        {/*
          BUSCA, não select.
          A primeira versão listava só responsáveis com mensalidade ativa —
          sete nomes. Quem pode ser cobrado é qualquer cliente da conta, e
          essa lista cresce até virar um select impossível de usar.
        */}
        <div>
          <span className="text-sm font-medium text-foreground">
            Cobrar de <span className="text-danger-text">*</span>
          </span>

          {escolhido ? (
            <div className="mt-1.5 flex items-center justify-between gap-3 rounded-md border border-input bg-muted/40 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {escolhido.nome}
                </span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {escolhido.documento ? mascararDoc(escolhido.documento) : "sem CPF cadastrado"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEscolhido(null);
                  setTermo("");
                }}
                className="shrink-0 rounded text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Trocar
              </button>
              <input type="hidden" name="guardian_id" value={escolhido.id} />
            </div>
          ) : cadastrando ? (
            /*
              Cadastro na hora: nem todo mundo que paga é responsável de aluno.
              Obrigar a virar responsável antes sujaria a base com gente que
              não responde por nenhum aluno.
            */
            <div className="mt-1.5 space-y-3 rounded-md border border-input p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cadastrar quem vai pagar
                </span>
                <button
                  type="button"
                  onClick={() => setCadastrando(false)}
                  className="rounded text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Buscar existente
                </button>
              </div>

              <input
                name="novo_nome"
                placeholder="Nome completo"
                defaultValue={inicial.nomeSugerido}
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <input
                name="novo_documento"
                inputMode="numeric"
                placeholder="CPF ou CNPJ"
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground tabular-nums outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="novo_email"
                  type="email"
                  placeholder="E-mail (opcional)"
                  className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
                <input
                  name="novo_telefone"
                  inputMode="numeric"
                  placeholder="Celular (opcional)"
                  className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground tabular-nums outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O celular abre a conversa já no contato certo na hora de
                entregar. Se o documento já existir, reaproveitamos o cadastro.
              </p>
            </div>
          ) : (
            <>
              <input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Digite o nome"
                autoComplete="off"
                className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />

              <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border">
                {buscando ? (
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">
                    Procurando…
                  </p>
                ) : resultados.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">
                    {termo.trim()
                      ? "Nenhum responsável com esse nome."
                      : "Digite para procurar."}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {resultados.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setEscolhido(r)}
                          className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                        >
                          <span className="text-sm text-foreground">{r.nome}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {r.documento ? mascararDoc(r.documento) : "sem CPF cadastrado"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="button"
                onClick={() => setCadastrando(true)}
                className="mt-2 rounded text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Não está na lista? Cadastrar quem vai pagar
              </button>
            </>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="valor" className="text-sm font-medium text-foreground">
              Valor <span className="text-danger-text">*</span>
            </label>
            <input
              id="valor"
              name="valor"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(mascaraDinheiro(e.target.value))}
              placeholder="R$ 0,00"
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-semibold text-foreground tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>

          <div>
            <label
              htmlFor="vencimento"
              className="text-sm font-medium text-foreground"
            >
              Vencimento <span className="text-danger-text">*</span>
            </label>
            <input
              id="vencimento"
              name="vencimento"
              type="date"
              defaultValue={inicial.vencimento}
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground tabular-nums outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="descricao"
            className="text-sm font-medium text-foreground"
          >
            Descrição <span className="text-danger-text">*</span>
          </label>
          <input
            id="descricao"
            name="descricao"
            defaultValue={inicial.descricao}
            placeholder="Ex.: Mensalidade de agosto — reemissão"
            className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Aparece para quem paga e no extrato da escola.
          </p>
        </div>

        <div>
          <span className="text-sm font-medium text-foreground">
            Forma de pagamento
          </span>
          <div className="mt-1.5 flex flex-wrap gap-2" role="group">
            {(
              [
                { v: "BOLETO", label: "Boleto e Pix" },
                { v: "PIX", label: "Só Pix" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setForma(o.v)}
                aria-pressed={forma === o.v}
                className={`h-11 rounded-md border px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  forma === o.v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-foreground hover:bg-muted"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="forma" value={forma} />
          {/* Cartão não é opção — o repasse só vem depois da liquidação da
              bandeira e fura o caixa da escola. */}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Sem cartão de crédito.
          </p>
        </div>

        {state.message && !state.ok ? (
          <Alert tone="danger">{state.message}</Alert>
        ) : null}

        <Button type="submit" disabled={enviando} className="h-11 w-full">
          {enviando ? "Criando…" : "Criar cobrança"}
        </Button>
      </Card>

      <Card className="h-fit space-y-3 p-6">
        <h2 className="text-sm font-semibold text-foreground">Quanto você recebe</h2>
        {liquido !== null ? (
          <>
            <p className="text-[22px] font-bold leading-7 text-foreground tabular-nums">
              {dinheiro(liquido)}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {dinheiro(bruto)} menos a taxa de {dinheiro(taxa!)}.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Informe o valor para ver o líquido.
          </p>
        )}
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Esta cobrança não cria nem altera matrícula, e não entra no
          faturamento contratado.
        </p>
      </Card>
    </form>
  );
}
