"use client";

import { useActionState, useState, useTransition } from "react";
import { Lock, RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  restaurarPermissoes,
  salvarPermissoes,
  type EstadoPermissoes,
} from "@/features/permissoes/actions";

type Item = { href: string; label: string; categoria: string };
type Papel = { chave: string; nome: string; descricao: string; editavel: boolean };

export function PainelPermissoes({
  papeis,
  categorias,
  itens,
  permitidasPorPapel,
  configurados,
}: {
  papeis: Papel[];
  categorias: Array<{ chave: string; nome: string }>;
  itens: Item[];
  permitidasPorPapel: Record<string, string[]>;
  configurados: Record<string, boolean>;
}) {
  const [papelAberto, setPapelAberto] = useState(papeis[0]?.chave ?? "");
  const papel = papeis.find((p) => p.chave === papelAberto)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {papeis.map((p) => (
          <button
            key={p.chave}
            type="button"
            onClick={() => setPapelAberto(p.chave)}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              p.chave === papelAberto
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:border-primary"
            }`}
          >
            {p.nome}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{papel.descricao}</p>

      {papel.editavel ? (
        <FormularioPapel
          key={papel.chave}
          papel={papel}
          categorias={categorias}
          itens={itens}
          permitidas={permitidasPorPapel[papel.chave] ?? []}
          configurado={configurados[papel.chave] ?? false}
        />
      ) : (
        <Alert tone="info">
          <p className="flex items-center gap-2 font-medium">
            <Lock className="h-4 w-4" /> A Direção vê tudo, e isso não é editável.
          </p>
          <p className="mt-1">
            É a única função que alcança esta tela. Se desse para tirar acesso
            dela, um clique errado trancaria a escola inteira para fora da própria
            administração — e o conserto viraria mexer no banco.
          </p>
        </Alert>
      )}
    </div>
  );
}

function FormularioPapel({
  papel,
  categorias,
  itens,
  permitidas,
  configurado,
}: {
  papel: Papel;
  categorias: Array<{ chave: string; nome: string }>;
  itens: Item[];
  permitidas: string[];
  configurado: boolean;
}) {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set(permitidas));
  const [estado, acaoSalvar, salvando] = useActionState<EstadoPermissoes, FormData>(
    salvarPermissoes,
    {},
  );
  const [restaurando, iniciarRestauro] = useTransition();

  /*
   * ITEM GUARDA-CHUVA ARRASTA OS DE BAIXO — e isso não é comodidade.
   *
   * A permissão é comparada por PREFIXO: liberar "/financeiro" libera
   * "/financeiro/recebimentos" junto, queira a escola ou não. Sem esta
   * amarração, marcar "Financeiro" deixaria oito caixinhas desmarcadas na
   * tela enquanto as oito telas abriam de verdade — a lista mentiria sobre o
   * que ela mesma faz. Arrastando, o que se vê é o que vale.
   *
   * Desmarcar arrasta pelo mesmo motivo: manter um filho marcado sob um pai
   * desmarcado sugere um acesso que o prefixo não concede mais.
   */
  const descendentes = (href: string) =>
    itens.filter((i) => i.href.startsWith(`${href}/`)).map((i) => i.href);

  function alternar(href: string) {
    setMarcadas((atual) => {
      const nova = new Set(atual);
      const filhos = descendentes(href);
      if (nova.has(href)) {
        nova.delete(href);
        for (const f of filhos) nova.delete(f);
      } else {
        nova.add(href);
        for (const f of filhos) nova.add(f);
      }
      return nova;
    });
  }

  function alternarCategoria(chave: string, ligar: boolean) {
    const daCategoria = itens.filter((i) => i.categoria === chave).map((i) => i.href);
    setMarcadas((atual) => {
      const nova = new Set(atual);
      for (const h of daCategoria) {
        if (ligar) nova.add(h);
        else nova.delete(h);
      }
      return nova;
    });
  }

  return (
    <form action={acaoSalvar} className="space-y-5">
      <input type="hidden" name="papel" value={papel.chave} />
      {[...marcadas].map((h) => (
        <input key={h} type="hidden" name="href" value={h} />
      ))}

      {estado.erro ? <Alert tone="danger">{estado.erro}</Alert> : null}
      {estado.ok ? (
        <Alert tone="success">
          Permissões salvas. Quem estiver logado passa a ver o novo menu na
          próxima página que abrir.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={configurado ? "brand" : "neutral"}>
          {configurado ? "Personalizado" : "Padrão"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {marcadas.size} de {itens.length} telas liberadas
        </span>
      </div>

      {categorias.map((cat) => {
        const daCategoria = itens.filter((i) => i.categoria === cat.chave);
        if (daCategoria.length === 0) return null;
        const todas = daCategoria.every((i) => marcadas.has(i.href));

        return (
          <section key={cat.chave} className="rounded-md border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
              <span className="font-medium text-foreground">{cat.nome}</span>
              <button
                type="button"
                onClick={() => alternarCategoria(cat.chave, !todas)}
                className="text-sm text-primary hover:underline"
              >
                {todas ? "Desmarcar todas" : "Marcar todas"}
              </button>
            </div>

            <ul className="divide-y divide-border">
              {daCategoria.map((item) => (
                <li key={item.href}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={marcadas.has(item.href)}
                      onChange={() => alternar(item.href)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm text-foreground">{item.label}</span>
                    {itens.some((i) => i.href.startsWith(`${item.href}/`)) ? (
                      <span className="text-xs text-muted-foreground">
                        abre tudo abaixo
                      </span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {marcadas.size === 0 ? (
        <Alert tone="warning">
          Nenhuma tela marcada. Salvando assim, quem tem esta função entra e não
          consegue abrir nada — é bloqueio, não volta ao padrão.
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
        {configurado ? (
          <Button
            type="button"
            variant="outline"
            disabled={restaurando}
            onClick={() => iniciarRestauro(() => void restaurarPermissoes(papel.chave))}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {restaurando ? "Restaurando…" : "Voltar ao padrão"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
