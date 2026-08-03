# Faturamento e recebimento — com e sem Asaas

Especificação de produto. Segue `docs/identidade-visual.md`.

| | |
|---|---|
| Problema | o indicador financeiro só existe para escola que cobra pelo Asaas |
| Arquivos | `src/features/school/modulo-financeiro.ts` · `src/features/baas/` · `src/features/school-metrics/` |
| Fora de escopo | integração com Conta Azul. Não haverá. |

---

## 01 • Duas camadas, não dois modos

O erro atual é tratar "usa Asaas" como um interruptor do módulo financeiro inteiro. São duas camadas independentes:

| Camada | O que é | De onde vem | Depende do Asaas? |
|---|---|---|---|
| **Faturamento contratado** | o que foi combinado | matrículas ativas × mensalidade, no próprio banco | **não** |
| **Recebimento** | o que entrou | Asaas, ou conciliação manual | sim, para ser automático |

Faturamento contratado é cálculo interno e sempre exato. Toda escola tem, desde o primeiro dia, sem integrar nada. Hoje ele é desligado junto com o resto — é o que precisa mudar.

`usa_pagamentos` deixa de significar "tem módulo financeiro" e passa a significar **"emite cobrança pelo sistema"**. Só isso.

---

## 02 • Origem é por cobrança, não por escola

Três origens, numa coluna de `aluno_assinatura`:

| origem | quem escreve |
|---|---|
| `asaas` | webhook |
| `manual` | baixa feita na tela de conciliação |
| `nenhuma` | contrato sem cobrança acompanhada pelo sistema |

Por que na cobrança e não na escola: **o DK é misto e vai continuar misto**. Contratos novos nascem no Asaas, os antigos ficam fora. Com flag de escola, o DK não cabe em lugar nenhum. Com coluna na cobrança, ele é o caso normal — e a migração não tem dia da virada: a proporção muda sozinha conforme os contratos migram.

---

## 03 • Recebimento tem denominador próprio

**A regra que impede o painel de mentir:** recebimento nunca é comparado com o faturamento total. É comparado com o que está sendo cobrado pelo sistema.

```
Faturamento contratado          R$ 272.669,27   ·  669 matrículas
                                                       └ todas

Cobrança pelo sistema           R$ [soma]       ·  [n] matrículas ([n/669]%)
  ├ recebido                    R$ [soma]          [%] do cobrado
  └ a receber                   R$ [soma]
```

Se "recebido" for lido contra os R$ 272 mil, uma escola com 14% dos contratos no Asaas parece estar levando calote de 86%. Contra o próprio denominador, é 81% de recebimento — que é a verdade.

**A linha de cobertura é obrigatória** em toda tela que mostra recebimento: `[n] de 669 matrículas cobradas pelo sistema`. Sem ela o número não é interpretável.

---

## 04 • Os três estados da escola

Nenhum deles esconde faturamento.

**A · Sem cobrança pelo sistema** (`usa_pagamentos = false`)
Faturamento contratado completo. Recebimento pela tela de conciliação manual. Inadimplência calculada do que não foi conciliado. Régua de cobrança e link de pagamento aparecem com cadeado e motivo.

**B · Cobrança pelo sistema, cobertura parcial** — o caso do DK
Faturamento completo. Recebimento com a linha de cobertura sempre visível. Contratos fora do Asaas: ou conciliação manual, ou `origem = nenhuma` e ficam de fora do recebimento, contando só no faturamento. **Nunca somem do faturamento.**

**C · Cobertura total**
Tudo automático. A linha de cobertura vira `669 de 669` e pode sumir.

---

## 05 • Conciliação manual — marcar, não digitar

O sistema já sabe quem deve o quê. A tela não é cadastro de lançamento; é uma lista pré-montada do mês onde se marca o que entrou.

```
Recebimentos de agosto/2026
669 cobranças esperadas · R$ 272.669,27          [ Marcar todos do dia 05 ]

  ✓  Ana Beatriz Ribeiro     R$ 407,58   venc. 05/08   recebido 05/08
  ✓  Bruno Carvalho Lima     R$ 445,00   venc. 05/08   recebido 06/08
  ○  Camila Fonseca          R$ 396,66   venc. 05/08   [ marcar recebido ]
  ○  Daniel Moreira Alves    R$ 508,31   venc. 10/08   [ marcar recebido ]

  Conciliado 412 de 669 · R$ 168.940,00
```

**Regras:**

- A lista é gerada das matrículas ativas do mês. Ninguém cadastra cobrança à mão.
- Um clique por linha. Lote por data de vencimento.
- Marcar pede só a data — o valor vem da matrícula, editável se entrou diferente.
- **O que sobra sem marcar é a inadimplência.** A mesma tela alimenta os dois indicadores.
- Desmarcar é possível e registra quem fez.
- Linha de cobrança com origem `asaas` aparece marcada e **bloqueada** — quem manda ali é o webhook.

Se essa tela virar formulário de digitação, ninguém usa, o dado fica vazio, e o indicador não existe do mesmo jeito.

---

## 06 • Selo de origem

Todo número de recebimento carrega como foi obtido. O que destrói confiança não é dado manual — é não saber qual é qual.

| Selo | Quando |
|---|---|
| `automático · há 3 min` | origem Asaas |
| `conciliado à mão · há 6 dias` | origem manual |
| `misto · 94 automáticas, 318 à mão` | escola B |

Faturamento contratado não leva selo. Ele é sempre exato e sempre da mesma fonte.

---

## 07 • Estratégia — mostrar o custo, não bloquear

Esconder número para forçar adoção é a forma mais rápida de a pessoa parar de abrir a tela.

**O que fazer:**

- Deixar o esforço visível no rodapé da conciliação: `Você marcou 412 cobranças este mês. Com cobrança pelo sistema, isso acontece sozinho e o atraso aparece no mesmo dia.` Número real, sem estimativa de horas inventada.
- Funções que dependem de cobrança pelo sistema — régua, link de pagamento, atraso no dia, baixa automática — aparecem **com cadeado e motivo**, nunca escondidas. Cadeado mudo irrita; cadeado explicado converte.
- Na escola B, a linha de cobertura é o próprio argumento: `94 de 669 matrículas cobradas pelo sistema`. Ela mostra o tamanho do que ainda é manual sem precisar de discurso.

**O que não fazer:** banner recorrente, badge "novo", modal na entrada, e qualquer estimativa de economia que o sistema não consiga provar.

---

## 08 • Modelo de dados

Sobre o que já existe. `guardian_financial_contracts` (o combinado) e `aluno_assinatura` (o estado da cobrança) permanecem.

**Em `aluno_assinatura`:**

| coluna | tipo | nota |
|---|---|---|
| `origem` | text | `asaas` · `manual` · `nenhuma` |

**Nova — `recebimento_manual`:**

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid | |
| `escola_id` | uuid | |
| `enrollment_id` | uuid | qual matrícula |
| `competencia` | date | mês de referência, dia 1 |
| `valor` | numeric | default = mensalidade da matrícula |
| `recebido_em` | date | |
| `created_by` / `created_at` | | quem marcou |

Único por `(enrollment_id, competencia)`. Desmarcar apaga a linha e registra em log.

A cobrança esperada **não é materializada** — é derivada de matrículas ativas × competência. Só o recebimento vira linha. Evita gerar 669 registros/mês que ninguém preencheria.

---

## 09 • Decisões pendentes

**9.1 · Contratos do DK fora do Asaas: `manual` ou `nenhuma`?**
`manual` dá inadimplência por aluno e custa marcar ~575 cobranças/mês. `nenhuma` não custa nada e o recebimento cobre só a fatia Asaas. Recomendação: `nenhuma` no começo, com a opção de conciliar quando quiser — a cobertura crescendo é a métrica de migração.

**9.2 · Quando um contrato migra para o Asaas, o que acontece com o histórico manual?**
Recomendação: nada. Competências passadas ficam com a origem que tinham. Reescrever histórico ao migrar é como o número de junho deixa de bater com o que foi visto em junho.

**9.3 · Escola sem `usa_pagamentos` vê "Inadimplência" no menu?**
Hoje some. Com conciliação manual ela passa a fazer sentido — mas só depois que houver conciliação. Recomendação: aparece a partir da primeira competência conciliada.

---

## 10 • Critério de pronto

- [ ] Faturamento contratado aparece para toda escola, com ou sem Asaas
- [ ] Nenhum número de recebimento aparece sem a linha de cobertura
- [ ] Nenhum contrato some do faturamento por não estar no Asaas
- [ ] Todo indicador de recebimento tem selo de origem
- [ ] Conciliação é marcar, não digitar — zero cadastro de cobrança
- [ ] Linha de origem `asaas` é somente leitura na conciliação
- [ ] O que não foi conciliado alimenta a inadimplência
- [ ] Função bloqueada mostra o motivo
- [ ] Nenhuma estimativa de economia que o sistema não consiga provar
- [ ] Migrar contrato para o Asaas não altera competência passada
