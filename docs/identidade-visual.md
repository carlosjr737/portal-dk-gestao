# Identidade visual e interface

**Plataforma de gestão para escolas de artes**

Documento de direção visual e aplicação no produto.
Fonte da verdade para tokens, componentes e linguagem. Toda decisão de UI se resolve aqui.

| | |
|---|---|
| Versão | 1.0 — agosto de 2026 |
| Base | *Direção de Identidade Visual e Interface*, agosto de 2026 |
| Estado | Fases 1 e 2 implementadas. Naming e logotipo pendentes (fase 5). |
| Nome comercial | Em definição. A interface lê de `NEXT_PUBLIC_PLATFORM_NAME`. |

> **Sobre o "D".** O produto nasce independente do DK Studio. O "D" permanece apenas como referência interna de origem — nunca como ligação pública. Nenhuma tela cita "Portal DK" ou "DK Studio".

---

## 01 • Direção estratégica

### A decisão central

A interface já tem maturidade de produto: hierarquia legível, cards de indicadores, visão de ocupação, área de atenção. O aprimoramento adiciona identidade própria **sem perder a clareza que já funciona**.

> **Tecnologia clara. Operação sob controle.**

### Diagnóstico

O problema nunca esteve na estrutura. Estava na ausência de um sistema visual proprietário e na permanência de códigos ligados ao DK.

| | |
|---|---|
| **Preservar** | hierarquia, cards de indicadores, visão de ocupação, área de atenção |
| **Eliminar** | magenta do DK, assinatura "Portal DK", metodologia interna exposta |
| **Construir** | símbolo, paleta, linguagem gráfica, tokens de interface, nomenclatura comercial |

### Posicionamento visual

| Dimensão | O que precisa transmitir | Como aparece |
|---|---|---|
| Tecnologia | produto confiável e atual | geometria limpa, tipografia precisa, interface consistente |
| Gestão | controle e capacidade de decisão | indicadores claros, hierarquia forte, ações prioritárias |
| Simplicidade | complexidade organizada | poucas cores, boa legibilidade, componentes previsíveis |
| Escala | marca preparada para crescer | sistema modular, linguagem independente de uma escola específica |

### Princípios que não mudam

1. **Clareza antes de decoração.**
2. **Marca separada dos estados de alerta.** Cobalto identifica a marca. Vermelho identifica problema. Uma cor nunca substitui a outra.
3. **Produto com personalidade, sem estética artística.**
4. **O D é detalhe de origem** — nunca uma ligação pública com o DK.

---

## 02 • Sistema visual

A marca deve parecer uma empresa de software especializada — não uma escola, não uma produtora cultural, não uma extensão visual do DK.

### Paleta principal

| Cor | Função | Uso | Token |
|---|---|---|---|
| `#5B5CE2` | **Cobalto** | marca, botão primário, link, navegação ativa | `--primary` |
| `#25265B` | **Índigo profundo** | barra lateral, grandes áreas de contraste | `--surface-inverse` |
| `#111827` | **Grafite** | texto principal, números de alta prioridade | `--foreground` |
| `#F6F7FB` | **Superfície** | fundo geral do produto, áreas de agrupamento | `--background` |
| `#E4E7EC` | **Borda** | divisores, contorno de card, estados neutros | `--border` |
| `#FFFFFF` | **Branco** | cards, conteúdo, áreas de respiro | `--card` |

**Contrastes verificados**

| Par | Razão | |
|---|---|---|
| Branco sobre Cobalto | 5,15:1 | ✅ |
| Cobalto sobre Branco (link) | 5,15:1 | ✅ |
| Cobalto sobre Superfície | 4,82:1 | ✅ |
| Branco sobre Índigo | 13,94:1 | ✅ |
| Grafite sobre Superfície | 16,57:1 | ✅ |
| Branco sobre Superfície | 1,07:1 | separação sutil — **por isso card não leva sombra em repouso** |

**Item ativo na barra lateral:** pílula preenchida em Cobalto com texto branco. O contorno da pílula contra o Índigo dá 2,70:1, mas o texto branco dentro resolve a identificação. Clarear o cobalto para `#7576E6` sobe o contorno para 3,64:1 e derruba o texto para 3,82:1 — não compensa. Mantém-se `#5B5CE2`.

### Contorno de campo é token separado

`--border` a `#E4E7EC` dá **1,24:1** contra o card branco. Serve para divisória, que é decorativa e não tem requisito. **Não serve para contorno de campo**, que precisa de 3:1 (WCAG 1.4.11) — e este produto é quase todo digitação.

| Token | Valor | Contraste | Uso |
|---|---|---|---|
| `--border` | `#E4E7EC` | 1,24:1 | divisória, contorno de card |
| `--input` | `#8794AA` | **3,07:1** | campo, select, textarea, botão `outline` |

O botão `variant="outline"` usa `border-input`, não `border-border` — senão fica mais claro que o campo ao lado dele na mesma linha de filtro.

### Cores semânticas

Cada tom tem **três papéis**. A cor cheia é preenchimento; como texto sobre branco ela reprova.

| Função | Preenchimento | sobre branco | Texto | sobre branco | Tinta |
|---|---|---|---|---|---|
| Informação | `#2F7DE1` | 4,08:1 ❌ | `#1D68CA` | 5,41:1 ✅ | `#E8F1FC` |
| Sucesso | `#16A36A` | 3,24:1 ❌ | `#107A4F` | 5,36:1 ✅ | `#E7F6EF` |
| Atenção | `#E99B15` | 2,29:1 ❌ | `#97640D` | 5,07:1 ✅ | `#FDF3E0` |
| Crítico | `#D64555` | 4,34:1 ❌ | `#C52B3C` | 5,55:1 ✅ | `#FBEAEC` |

Selo (texto escuro sobre a tinta correspondente): entre 4,60:1 e 4,80:1. Todos passam.

| Onde | O que usar |
|---|---|
| Barra, ponto, fatia, ícone de estado | preenchimento — `bg-danger` |
| Rótulo, número colorido | texto — `text-danger-text` |
| Fundo de selo e alerta | tinta — `bg-danger-tint` |

> **Regra essencial.** O cobalto identifica a marca. O vermelho identifica problema. Uma cor nunca substitui a outra.

Nomeie pelo **significado** (`tone="danger"`), nunca pela cor (`tone="red"`). Um par por tom, sem exceção.

### Faixas de desempenho

Ocupação é uma sequência, não quatro categorias soltas: dois estados de problema, dois de saúde.

| Posição | Cor | Significado |
|---|---|---|
| Crítico | `#C52B3C` | risco de encerrar |
| Atenção | `#97640D` | precisa de captação |
| Saudável | `#107A4F` | dentro da meta |
| Saudável+ | `#0B5A3A` | acima da meta |

Quatro posições, três matizes. Os dois estados saudáveis dividem o mesmo verde em duas intensidades porque são o mesmo estado com pesos diferentes.

As faixas são **configuráveis por escola** (ver seção 06). Os nomes atuais — CTI, Em recuperação, Em alta, Alta performance — são o padrão de uma instituição, não do produto.

### Tipografia

**Família única: Inter.** Pesos 400, 500, 600 e 700. Carregada por `next/font/google`.

| Elemento | Tamanho / entrelinha | Peso |
|---|---|---|
| Título de página | 24 / 32 px | 700 |
| Indicador principal | 28 / 34 px | 700, numerais tabulares |
| Título de seção | 18 / 26 px | 600 |
| Título de card | 14 / 20 px | 600 |
| Texto padrão | 14 / 20 px | 400 |
| Texto auxiliar | 12 / 16 px | 400 |

**Nunca abaixo de 12 px.** Todo número alinhado em coluna leva `tabular-nums` — sem isso a coluna dança linha a linha. Teto por tela: 4 tamanhos, 3 pesos.

Logotipo: desenho tipográfico próprio, definido depois do nome.

---

## 03 • Símbolo e linguagem gráfica

O símbolo pode nascer da letra **D**, mas deve ser percebido como ícone de software: modular, simples, reconhecível em tamanho pequeno.

**Construção recomendada**

- Haste vertical firme: estrutura e controle.
- Curva formada por módulos: integração entre áreas.
- Espaço negativo central: clareza e leitura.
- Pequeno deslocamento: evolução, sem simular dança.

**Critérios de aprovação**

- Funciona em 16 px, 24 px e 32 px sem perder leitura.
- Continua reconhecível em uma única cor.
- Não forma "DK" nem remete visualmente ao DK Studio.
- Não parece ícone genérico de play, palco, dança ou escola.
- Pode existir sozinho no favicon e ao lado do nome no sistema.

### Assinatura gráfica

| Usar | Evitar |
|---|---|
| blocos, recortes, grids, conexões discretas | ondas, pinceladas, silhuetas, gestos artísticos |
| contraste alto e áreas de respiro | gradientes excessivos e fundos decorativos |
| movimento por transição e organização | animação que simula dança ou espetáculo |

### Ícones de interface

`lucide-react`, traço 1,5. Uma família só.

- 16 px inline com texto, 17 px na navegação, 20 px isolado.
- Ícone sozinho exige `aria-label`.
- Chevron de acordeão é componente, não glifo de texto — `▾` renderiza com peso e alinhamento diferentes por sistema operacional.

---

## 04 • Aplicação no produto

A identidade reforça o que o software faz melhor: organizar a operação e mostrar onde o gestor precisa agir.

### Arquitetura visual da tela

| Camada | Direção |
|---|---|
| Barra lateral | Índigo profundo; ícone em cada item; item ativo em cobalto |
| Fundo | Superfície cinza muito clara, para separar áreas sem criar ruído |
| Cards | Brancos, borda sutil, raio 12 px, sem sombra em repouso |
| Ações | **Um botão primário por contexto**; secundárias com contorno ou texto |
| Indicadores | Números grandes, rótulos diretos, comparação com período anterior |
| Alertas | Cor semântica + ícone + texto — **nunca depender apenas da cor** |

### Sistema de componentes

- **Grid de 8 px.** Valores permitidos: 4 · 8 · 12 · 16 · 24 · 32 · 48.
- **Raio:** 12 px em card e painel, 8 px em campo, botão e chip, pílula em selo e avatar.
- **Bordas neutras.** Sombra reservada para sobreposição e foco.
- **Altura de controle:** 40 px padrão — botão e campo iguais, para alinharem na mesma linha. 36 px compacto, 44 px grande.
- **Foco visível** em `:focus-visible`, global: `outline: 2px solid var(--primary)`, `offset: 2px`.

| Situação | Espaçamento |
|---|---|
| Padding de card | 20 px |
| Entre cards irmãos | 16 px |
| Entre seções | 24 px |
| Rótulo → campo | 4 px |
| Célula de tabela | 16 px × 12 px |
| Margem da página | 24 px |

### Componentes canônicos

Em `src/components/ui/`. São o único caminho.

`Button` · `Card` · `Table` · `Badge` · `Input` · `Select` · `Textarea` · `Field` · `Alert` · `Sparkline` · `PageHeader`

| Nunca | Sempre |
|---|---|
| `<button className="h-10 rounded-md bg-…">` | `<Button variant="…">` |
| `<div className="rounded-md border bg-white p-4">` | `<Card>` |
| `<label><span>…</span><input></label>` | `<Field label="…">` |
| `<span className="bg-emerald-50 text-emerald-700">` | `<Badge tone="success">` |
| `<h1 className="text-2xl…">` | `<PageHeader title="…">` |
| qualquer `#` dentro de componente | token |

**Variantes de botão**

| Variante | Para |
|---|---|
| `default` | ação principal — uma por contexto |
| `outline` | Voltar, Cancelar, Filtrar, Exportar, Limpar |
| `secondary` | Imprimir e ênfase intermediária |
| `ghost` | ação terciária em lista ou card |
| `destructive` | Excluir |

### Estados obrigatórios

Nenhuma tela sobe sem os cinco.

| Estado | Regra |
|---|---|
| Hover | toda linha e card clicável reage |
| Foco | anel visível, via regra global |
| Carregando | controle desabilitado, rótulo no gerúndio ("Salvando…") |
| Vazio | nunca `<tbody>` sem linha; texto específico da tela |
| Erro | diz o que houve e o que fazer, ligado ao campo por `aria-describedby` |

| Estado | Cor | Exemplo de texto |
|---|---|---|
| Neutro | Grafite | Em acompanhamento |
| Informação | Azul | Atualizado há 2 horas |
| Sucesso | Verde | Meta atingida |
| Atenção | Âmbar | Vencimento em 3 dias |
| Crítico | Vermelho | Pagamento atrasado |

---

## 05 • Dashboard

O painel inicial responde três perguntas: **como a escola está**, **o que precisa de atenção** e **onde há oportunidade de crescimento**.

| Ordem | Bloco | Conteúdo |
|---|---|---|
| 01 | Resumo executivo | alunos ativos, matrículas, faturamento, inadimplência, variação |
| 02 | Precisam de atenção | cobranças, turmas críticas, contratos pendentes, alertas |
| 03 | Operação | ocupação, frequência, capacidade, desempenho das turmas |
| 04 | Tendências | evolução mensal, entradas, saídas, projeções |
| 05 | Ações rápidas | criar matrícula, registrar pagamento, abrir turma, exportar |

### Regras de dados

> **O número na tela tem que bater com a regra da fonte, não com a aparência.** Gráfico que não muda uma decisão sai da tela.

- **Bloco sem dado não aparece.** Nunca preencher com valor plausível. Painel em que um número é chute é painel em que nenhum número é confiável.
- **Todo número leva a algum lugar.** Faixa de barra, fatia, linha de lista: link com chevron.
- **Todo número principal traz contexto:** uma linha secundária derivada e a variação contra o período anterior.
- Paleta fixa nos gráficos, zero cor decorativa.
- Sparkline sempre com a janela declarada, sem eixo. Menos de dois pontos não desenha.
- Barra empilhada só quando as partes somam um todo real.
- SVG inline. Biblioteca de gráfico só se precisar de tooltip ou zoom.
- Formato pt-BR: `R$ 118.430`, `4,1%`, `14/03/2011`.

### "Precisam de atenção" é fila, não lista

Ordenada por urgência, com o próximo passo implícito no destino do link. Cada linha carrega turma, professor, sala e ocupação contra a capacidade.

---

## 06 • Linguagem e nomenclatura

Uma plataforma, não um sistema interno. O produto precisa servir qualquer escola sem parecer adaptado a partir de uma delas.

| Interno / atual | Recomendação comercial | Regra |
|---|---|---|
| Portal DK | *[nome da plataforma]* | substituição integral na interface |
| DK Studio | nome da escola cliente | variável por instituição — vem de `school.nome` |
| DNA do Professor | Acompanhamento pedagógico | pode ser configurável |
| Métricas da escola | Visão geral | nome orientado à tarefa |
| Métricas do público | Perfil dos alunos | mais claro e específico |
| CTI / Em recuperação / Em alta | Faixas de desempenho | categorias configuráveis |

**Onde aparece o quê.** Instituição → nome da escola do usuário logado. Produto → constante de `src/lib/branding.ts`. A marca não se repete: aparece uma vez, na barra lateral, e o cabeçalho não a devolve.

### Tom de voz

- **Objetivo e útil:** frases curtas, verbos de ação, mensagens que explicam o próximo passo.
- **Seguro:** confirma ações relevantes, evita termos ambíguos.
- **Humano:** simples e próximo, sem infantilização nem excesso de informalidade.

Voz ativa e nome estável: o botão que diz "Salvar" produz "Salvo".

| Evitar | Preferir |
|---|---|
| Ops! Algo deu errado. | Não foi possível salvar. Revise os campos destacados e tente novamente. |
| Turma ruim | Ocupação abaixo da meta |
| Aluno inadimplente | Pagamento em atraso |
| Submeter | Salvar alterações |

---

## 07 • Plano de aplicação

Evoluir por camadas, usando o dashboard como tela-piloto e transformando as decisões em sistema reutilizável.

| Fase | Entrega | Estado |
|---|---|---|
| 1. Fundamentos | paleta, tipografia, tokens | ✅ implementado |
| 2. Tela-piloto | dashboard, login, navegação | ✅ implementado |
| 3. Componentes | botões, cards, tabelas, filtros, formulários, alertas | 🟡 base pronta, adoção parcial |
| 4. Migração | aplicação gradual nas demais telas | ⬜ |
| 5. Marca final | naming, logotipo, símbolo, materiais | ⬜ |

### Onde cada coisa vive no código

| O quê | Arquivo |
|---|---|
| Tokens de cor e raio | `src/app/globals.css` (`:root`) |
| Mapeamento para utilitários | `tailwind.config.ts` |
| Tipografia | `src/app/layout.tsx` (`next/font`) |
| Nome do produto | `src/lib/branding.ts` ← `NEXT_PUBLIC_PLATFORM_NAME` |
| Nome da escola | `src/features/school/escola-nome.ts` ← `school.nome` |
| Faixas de desempenho | `src/lib/class-performance.ts` |
| Componentes | `src/components/ui/` |

### Checklist de aprovação

1. A interface não mantém nenhuma associação visual direta com o DK.
2. Existe **um** elemento dominante? O olho acha o principal em menos de 1 segundo?
3. Botões, alertas e indicadores usam cores com funções distintas — cobalto para comando, vermelho só para crítico.
4. Textos auxiliares com no mínimo 12 px.
5. Todos os estados têm rótulo ou ícone, não só cor.
6. Nomes internos removidos ou transformados em configuração.
7. Espaçamento saiu do grid de 8 px.
8. Máximo 4 tamanhos e 3 pesos de fonte.
9. Hover, foco, carregando, vazio e erro — os cinco.
10. Zero `#` no componente, zero `<button>` cru, zero `bg-white` literal.
11. Todo número em coluna com `tabular-nums`; todo número relevante leva a algum lugar.
12. Funciona em 1024 px sem rolagem horizontal.
13. Texto ≥ 4,5:1; contorno de controle ≥ 3:1.
14. Serve para dança, música, teatro, circo e escolas multidisciplinares.

---

## Registro de decisões

Toda mudança de token entra aqui com o motivo. Manual sem histórico vira manual que ninguém confia.

| Data | Decisão | Motivo |
|---|---|---|
| ago/2026 | Marca passa a Cobalto `#5B5CE2`; magenta do DK sai | direção aprovada: produto independente |
| ago/2026 | Família única Inter; `font-family: Arial` removido do `globals.css` | a declaração nunca valia — `font-sans` vencia por especificidade — e o produto rodava na fonte do sistema |
| ago/2026 | `--background` sobe para `#F6F7FB` | contra o card branco, `#FCFCFC` dava 1,02:1 e a tela lia como uma folha só |
| ago/2026 | Novo token `--primary-hover: 240 70% 56%` | o hover do botão primário era `opacity-90`, que deixa o cobalto translúcido e empurra o texto branco para a beira do AA. Cor sólida mais escura sobe o contraste com branco de 5,26:1 para **7,01:1** — de AA para AAA |
| ago/2026 | Índigo (`--surface-inverse`) passa a fundo do rodapé da landing | o token existia e não aparecia em pixel nenhum da página pública: branco, cinza e um botão cobalto liam como template. Branco sobre índigo = 13,94:1 |
| ago/2026 | Sobre o índigo, cobalto sai de link e de anel de foco | cobalto sobre índigo dá **2,65:1** — reprova até o mínimo de 3:1 de componente não-textual. Em superfície escura, link e `focus-visible` vão a branco |

**Nota sobre o nome da classe.** O token é `--surface-inverse`, mas a chave no
`tailwind.config.ts` é `inverse` — a utilitária é **`bg-inverse`**.
`bg-surface-inverse` não existe e não gera CSS: usá-la deixa o elemento
transparente sem erro nenhum para avisar.

**Nota sobre o anel de foco.** Ele vem da regra global `:focus-visible` no
`globals.css`, e não do `buttonVariants` — o comentário do componente afirmava
o contrário e foi corrigido. Como a regra desenha o anel em `--primary`, todo
uso sobre superfície escura precisa trocar o anel no ponto de uso.
| ago/2026 | `--input` `#8794AA` separado de `--border` | contorno de controle precisa de 3:1; divisória não |
| ago/2026 | Variante `-text` para cada cor semântica | as quatro cores reprovam como texto sobre branco (2,29:1 a 4,34:1) |
| ago/2026 | Faixas de desempenho em três matizes | o violeta anterior sugeria uma natureza que não existe |
| ago/2026 | Acordeão da navegação abre vários grupos | abrir um fechava o outro; quem trabalha entre dois pagava dois cliques por ida e volta |
| ago/2026 | Marca sai do cabeçalho no desktop | repetia a barra lateral a 20 px de distância |
| — | Nome comercial, logotipo e símbolo | **pendente — fase 5** |
| — | Faixas de ocupação: `0–5/6–10/11–15/16+` vs `≤5/6–9/11–17/≥18` | **pendente — regra de negócio, não de design** |

---

### Decisão recomendada agora

> Validar a personalidade da marca no produto — dashboard, login e navegação já estão na direção. **Naming e logotipo definitivo entram depois dessa validação**, não antes.
