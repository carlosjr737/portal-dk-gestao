---
name: revisar-ui-dk
description: Use quando existir uma interface já construída e o pedido for melhorá-la — "revisa essa tela", "melhora esse layout", "o design está amador", "essa página não convence", "deixa mais bonito", "review this UI", "improve this design". Vale para qualquer stack (React, Next.js, Tailwind, HTML/CSS, FlutterFlow, WordPress). Não usar para criar telas do zero nem para auditoria de acessibilidade.
---

# Revisar UI (padrão DK)

## Overview

Revisão de design visual e de UX sobre interface **existente**. O princípio central: **diagnóstico antes de prescrição** — nenhuma sugestão sai sem apontar o elemento exato, o problema e o valor concreto que substitui o atual.

Reescrever a tela inteira não é revisão. É fuga do diagnóstico.

## Quando usar

**Usar quando:**
- A tela funciona mas "parece errada", amadora, poluída ou genérica
- Existe código/print/URL de uma interface já pronta
- O pedido é comparar o resultado atual com a identidade da marca

**Não usar — outra skill resolve melhor:**
| Situação | Skill correta |
|---|---|
| Criar tela/componente do zero | `frontend-design` |
| Auditoria de acessibilidade / Web Interface Guidelines | `web-design-guidelines` |
| Escolher ou instalar componentes | `shadcn` |

## Fluxo obrigatório

Rodar as seis passadas **nesta ordem**. A ordem importa: cor não conserta hierarquia quebrada, e animação não conserta espaçamento errado.

1. **Hierarquia** — o olho encontra a informação principal em menos de 1 segundo? Existe um único elemento dominante por bloco?
2. **Espaçamento e ritmo** — os espaços seguem uma escala (4/8px ou múltiplos)? Elementos relacionados estão mais próximos entre si do que dos não relacionados?
3. **Tipografia** — quantos tamanhos e pesos existem na tela? Mais de 4 tamanhos ou 3 pesos = ruído. Largura de linha entre 45 e 75 caracteres.
4. **Cor e contraste** — a cor de destaque aparece em quantos lugares? Se aparece em tudo, não destaca nada. Verificar contraste de texto contra fundo.
5. **Estados e interação** — existem hover, focus, loading, vazio e erro? Estado vazio sem tratamento é o defeito mais comum.
6. **Aderência de marca** — comparar contra `tokens-dk.md`. Divergência é apontada, não corrigida silenciosamente.

## Formato de saída

Sempre priorizado, nunca em ordem de leitura do arquivo:

```
[CRÍTICO] Header — src/components/Header.tsx:42
Problema: três pesos de fonte concorrendo no mesmo bloco; o logo perde para o menu.
Correção: menu para font-normal text-sm; logo mantém font-semibold text-lg.
Por quê: um dominante por bloco.
```

Níveis: `CRÍTICO` (quebra compreensão ou uso), `ALTO` (a tela parece amadora), `MÉDIO` (refinamento).

Regra de ouro: **no máximo 3 itens CRÍTICOS por revisão.** Se tudo é crítico, nada é — repriorize.

## Tradução por stack

O diagnóstico é o mesmo; muda só a expressão da correção.

| Stack | Como entregar a correção |
|---|---|
| Tailwind / shadcn | classes utilitárias exatas (`gap-6`, `text-muted-foreground`) |
| CSS / styled-components | propriedade + valor, referenciando custom properties |
| FlutterFlow | nome do padding/tema no painel, não código |
| WordPress / builder | caminho no painel + valor |
| HTML/CSS puro | bloco CSS pronto para colar |

Nunca entregar refatoração de arquitetura junto com correção visual. São revisões separadas.

## Erros comuns

| Erro | Consequência |
|---|---|
| Propor redesign completo | O usuário pediu revisão, não recomeço — e nada é aplicável |
| Sugerir sem ver o render | Diagnóstico baseado em código lido "de cabeça" erra hierarquia visual |
| Trocar cor sem checar contraste | Troca um problema estético por um de legibilidade |
| Adicionar animação/sombra/gradiente cedo | Maquia hierarquia ruim em vez de consertá-la |
| Listar 20 itens sem prioridade | Nada é implementado |
| "Ficou ótimo, só uns ajustes" | Elogio sem diagnóstico não é revisão |

## Red flags — pare e volte ao passo 1

- A correção proposta mexe em mais de 30% do arquivo
- Você usou "moderno", "clean" ou "profissional" sem dizer qual propriedade muda
- Você começou pela cor
- Você não sabe qual é o elemento dominante da tela

## Referência

`${CLAUDE_PROJECT_DIR}/docs/identidade-visual.md` — documento de identidade visual da plataforma: paleta (Cobalto `#5B5CE2`, Índigo `#25265B`), tipografia Inter, grid de 8px, cores semânticas com variantes de preenchimento e de texto, nomenclatura comercial, checklist de aprovação e registro de decisões.

Ele vive no repositório, não aqui, para ser um arquivo só: quem escreve código e quem revisa leem a mesma versão, e o histórico de decisões fica versionado ao lado do que descreve.

**Ler antes das passadas 4 e 6**, não só da 6 — as cores semânticas têm valores diferentes para preenchimento e para texto, e trocar um pelo outro reprova contraste.

Regras que valem em toda revisão, mesmo sem abrir o documento:

- Cobalto é comando. Vermelho é problema. Uma cor nunca substitui a outra.
- Cor de preenchimento ≠ cor de texto.
- Alerta nunca depende só de cor — ícone + rótulo.
- Nenhum hex dentro de componente.
- Nada de "Portal DK", "DK Studio" ou nome de metodologia interna na interface.
