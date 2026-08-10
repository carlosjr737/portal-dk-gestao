"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Bold, Italic, Link2, List, Lock, RotateCcw, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  enviarTeste,
  restaurarTemplate,
  salvarTemplate,
  type EstadoSalvar,
  type EstadoTeste,
} from "@/features/comunicacao/actions";

type Variavel = { nome: string; rotulo: string; exemplo: string };

type ItemCatalogo = {
  chave: string;
  grupo: string;
  nome: string;
  quandoSai: string;
  variaveis: Variavel[];
  obrigatorias: Array<{ nome: string; porque: string }>;
  botao: { rotulo: string; variavelDoLink: string } | null;
};

type Texto = { chave: string; assunto: string; corpo: string; personalizado: boolean };

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function PainelComunicacao({
  grupos,
  catalogo,
  textos,
  historico,
  molduraHtml,
  marcador,
}: {
  grupos: Array<{ chave: string; nome: string; descricao: string }>;
  catalogo: ItemCatalogo[];
  textos: Texto[];
  historico: Array<{ chave: string; acao: string; autor_email: string | null; criado_em: string }>;
  molduraHtml: string;
  marcador: string;
}) {
  const [aberta, setAberta] = useState<string | null>(null);

  if (aberta) {
    const item = catalogo.find((c) => c.chave === aberta)!;
    return (
      <Editor
        item={item}
        texto={textos.find((t) => t.chave === aberta)!}
        historico={historico.filter((h) => h.chave === aberta)}
        molduraHtml={molduraHtml}
        marcador={marcador}
        aoVoltar={() => setAberta(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      {grupos.map((g) => (
        <section key={g.chave} className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{g.nome}</h2>
            <p className="text-sm text-muted-foreground">{g.descricao}</p>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-white">
            {catalogo
              .filter((c) => c.grupo === g.chave)
              .map((c) => {
                const t = textos.find((x) => x.chave === c.chave)!;
                const ultima = historico.find((h) => h.chave === c.chave);
                return (
                  <li key={c.chave}>
                    <button
                      type="button"
                      onClick={() => setAberta(c.chave)}
                      className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{c.nome}</span>
                          {t.personalizado ? (
                            <Badge tone="brand">Personalizado</Badge>
                          ) : (
                            <Badge tone="neutral">Padrão</Badge>
                          )}
                        </span>
                        <span className="mt-1 block truncate text-sm text-muted-foreground">
                          {t.assunto}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {c.quandoSai}
                          {ultima
                            ? ` · editado em ${dataHora(ultima.criado_em)}${ultima.autor_email ? ` por ${ultima.autor_email}` : ""}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-primary">Editar</span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Editor({
  item,
  texto,
  historico,
  molduraHtml,
  marcador,
  aoVoltar,
}: {
  item: ItemCatalogo;
  texto: Texto;
  historico: Array<{ acao: string; autor_email: string | null; criado_em: string }>;
  molduraHtml: string;
  marcador: string;
  aoVoltar: () => void;
}) {
  const [assunto, setAssunto] = useState(texto.assunto);
  const [corpo, setCorpo] = useState(texto.corpo);
  const corpoRef = useRef<HTMLDivElement>(null);

  const [salvo, acaoSalvar, salvando] = useActionState<EstadoSalvar, FormData>(
    salvarTemplate,
    {},
  );
  const [teste, acaoTeste, testando] = useActionState<EstadoTeste, FormData>(enviarTeste, {});
  const [restaurando, iniciarRestauro] = useTransition();

  // O conteúdo inicial entra uma vez. Reescrever o innerHTML a cada tecla
  // jogaria o cursor para o começo da caixa a cada letra digitada.
  useEffect(() => {
    if (corpoRef.current) corpoRef.current.innerHTML = texto.corpo;
  }, [texto.corpo]);

  function formatar(comando: string) {
    corpoRef.current?.focus();
    document.execCommand(comando);
    setCorpo(corpoRef.current?.innerHTML ?? "");
  }

  function inserirLink() {
    const url = window.prompt("Endereço do link (começando com https://)");
    if (!url || !/^https?:\/\//i.test(url)) return;
    corpoRef.current?.focus();
    document.execCommand("createLink", false, url);
    setCorpo(corpoRef.current?.innerHTML ?? "");
  }

  /* Variável entra por botão: ninguém precisa decorar que as chaves são { }. */
  function inserirVariavel(nome: string) {
    corpoRef.current?.focus();
    document.execCommand("insertText", false, `{${nome}}`);
    setCorpo(corpoRef.current?.innerHTML ?? "");
  }

  const exemplos = Object.fromEntries(item.variaveis.map((v) => [v.nome, v.exemplo]));
  const preencher = (s: string) =>
    s.replace(/\{([a-z_]+)\}/g, (_, n: string) => exemplos[n] ?? "");

  const linkBotao = item.botao ? (exemplos[item.botao.variavelDoLink] ?? "") : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={aoVoltar} className="text-sm text-primary hover:underline">
            ← Todos os e-mails
          </button>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{item.nome}</h2>
          <p className="text-sm text-muted-foreground">{item.quandoSai}</p>
        </div>

        {texto.personalizado ? (
          <Button
            type="button"
            variant="outline"
            disabled={restaurando}
            onClick={() => iniciarRestauro(() => void restaurarTemplate(item.chave as never))}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {restaurando ? "Restaurando…" : "Restaurar padrão"}
          </Button>
        ) : null}
      </div>

      {salvo.erro ? <Alert tone="danger">{salvo.erro}</Alert> : null}
      {salvo.ok ? <Alert tone="success">Texto salvo. Já vale para os próximos envios.</Alert> : null}

      {/* A recusa diz QUAL variável falta e o estrago de não ter. */}
      {salvo.faltando?.length ? (
        <Alert tone="danger">
          <p className="font-medium">Falta variável obrigatória:</p>
          <ul className="mt-2 space-y-1">
            {salvo.faltando.map((f) => (
              <li key={f.nome}>
                <code className="rounded bg-primary/10 px-1 text-primary">{`{${f.nome}}`}</code>{" "}
                {f.porque}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {teste.erro ? <Alert tone="danger">{teste.erro}</Alert> : null}
      {teste.ok ? (
        <Alert tone="success">Teste enviado para {teste.enviadoPara}.</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Edição ─────────────────────────────────────────────── */}
        <form action={acaoSalvar} className="space-y-4">
          <input type="hidden" name="chave" value={item.chave} />
          <input type="hidden" name="corpo" value={corpo} />

          <div className="space-y-1.5">
            <label htmlFor="assunto" className="text-sm font-medium text-foreground">
              Assunto
            </label>
            <Input
              id="assunto"
              name="assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Mensagem</span>

            <div className="rounded-md border border-border bg-white">
              {/* Barra mínima. Sem fonte, cor ou tamanho: o e-mail segue a
                  identidade, e liberar isso produz e-mail feio em nome da escola. */}
              <div className="flex gap-1 border-b border-border p-1.5">
                <BotaoBarra rotulo="Negrito" aoClicar={() => formatar("bold")}>
                  <Bold className="h-4 w-4" />
                </BotaoBarra>
                <BotaoBarra rotulo="Itálico" aoClicar={() => formatar("italic")}>
                  <Italic className="h-4 w-4" />
                </BotaoBarra>
                <BotaoBarra rotulo="Lista" aoClicar={() => formatar("insertUnorderedList")}>
                  <List className="h-4 w-4" />
                </BotaoBarra>
                <BotaoBarra rotulo="Link" aoClicar={inserirLink}>
                  <Link2 className="h-4 w-4" />
                </BotaoBarra>
              </div>

              <div
                ref={corpoRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setCorpo(e.currentTarget.innerHTML)}
                className="min-h-[220px] p-3 text-sm leading-6 text-foreground outline-none [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-3"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Inserir informação</p>
            <div className="flex flex-wrap gap-2">
              {item.variaveis.map((v) => {
                const obrigatoria = item.obrigatorias.some((o) => o.nome === v.nome);
                return (
                  <button
                    key={v.nome}
                    type="button"
                    onClick={() => inserirVariavel(v.nome)}
                    title={`Insere: ${v.exemplo}`}
                    className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
                  >
                    {v.rotulo}
                    {obrigatoria ? " *" : ""}
                  </button>
                );
              })}
            </div>
            {item.obrigatorias.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                * obrigatória — sem ela o e-mail não cumpre o que promete.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
            <Button type="submit" variant="outline" formAction={acaoTeste} disabled={testando}>
              <Send className="mr-2 h-4 w-4" />
              {testando ? "Enviando…" : "Enviar teste para mim"}
            </Button>
          </div>
        </form>

        {/* ── Prévia ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Prévia</p>

          <div className="overflow-hidden rounded-md border border-border">
            <div className="border-b border-border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                De: <span className="text-foreground">SouAle &lt;contato@souale.com.br&gt;</span>
              </p>
              <p className="mt-1 font-medium text-foreground">{preencher(assunto)}</p>
            </div>

            <iframe
              title="Prévia do e-mail"
              className="h-[420px] w-full bg-white"
              srcDoc={molduraHtml.replace(
                marcador,
                preencher(corpo) +
                  (linkBotao
                    ? `<p style="margin:24px 0 0;"><a href="${linkBotao}" style="display:inline-block;background:#5B5CE2;color:#FFF;text-decoration:none;font:600 15px/1 sans-serif;padding:14px 24px;border-radius:8px;">${item.botao!.rotulo}</a></p>`
                    : ""),
              )}
            />
          </div>

          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Lock className="h-3.5 w-3.5" /> Blocos fixos
            </p>
            <p>
              O cabeçalho com a marca{item.botao ? `, o botão “${item.botao.rotulo}”` : ""} e o
              rodapé não se editam. Eles podem mudar de posição, nunca sumir.
            </p>
          </div>

          {historico.length > 0 ? (
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">Histórico</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {historico.slice(0, 6).map((h, i) => (
                  <li key={i}>
                    {h.acao === "restaurou" ? "Restaurou o padrão" : "Salvou"} ·{" "}
                    {dataHora(h.criado_em)}
                    {h.autor_email ? ` · ${h.autor_email}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BotaoBarra({
  rotulo,
  aoClicar,
  children,
}: {
  rotulo: string;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      title={rotulo}
      aria-label={rotulo}
      className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
