# Roadmap — BaaS + Multi-escola (SaaS)

> Decisão de arquitetura: [ADR 0001](adr/0001-pagamentos-multiescola.md).
> Base regulatória: Resolução Conjunta nº 16/2025 (BACEN) + Playbook/Checklist de BaaS do Asaas.
> Perfil confirmado: **BaaS "Direta Tomador"** (Asaas → DK → escola/aluno), subconta modelo **BaaS** (experiência 100% no portal).

## Estado atual (2026-07-31)

- Portal é **single-school** (DK Studio). Não existe `escola_id` nem tabela `school` no código.
- Cobrança hoje = **Conta Azul** (será desligado no multi-escola, ver ADR 0001).
- Existe protótipo funcional de criação de subconta em **sandbox**: `/configuracoes/baas-preview`.
- Contrato de BaaS com o Asaas: **não assinado** → API de subconta de produção ainda bloqueada.

---

## Fase 0 — Habilitação regulatória (em andamento)

**Objetivo:** destravar o contrato de BaaS. É gate bloqueante: sem ele, a API de produção não libera.

| # | Entrega | Status |
|---|---|---|
| 0.1 | Protótipo da tela de subconta com selo Asaas (evidência Q06) | ✅ feito (`/configuracoes/baas-preview`) |
| 0.2 | Criar subconta real no sandbox e capturar print | ✅ subconta `78c9177b-…` criada (wallet `72b51abf-…`) |
| 0.3 | Preencher e enviar o Checklist BaaS (Google Forms do Asaas) | ✅ enviado |
| 0.4 | Análise do Asaas (~3 dias úteis) + eventuais ajustes | ⏳ |
| 0.5 | Assinatura do contrato de BaaS | ⏳ |
| 0.6 | Questionário de Segurança da Informação | ⏳ |
| 0.7 | Validação jurídica/contábil (custódia, split, tributação da taxa) | ⏳ **único custo em dinheiro previsto** |

**Respostas do checklist já definidas:** Q01 Não · Q02 Sim · Q03 Sim · Q04 Não · Q05 (a) Direta Tomador · Q06 Sim · Q07 Sim · Q08 Não · Q09 Não · Q13 Subcontas BaaS. Faltam: razão social, nº funcionários, faturamento, Q12.

### Aprendizados da integração sandbox

- **`ASAAS_API_KEY` começa com `$`** → o Next.js (`@next/env` + dotenv-expand) trata como variável e a chave vira `undefined` (dá 401). No `.env.local` precisa escapar: `ASAAS_API_KEY=\$aact_…`. **Na Vercel não escapar** — o painel guarda o valor literal.
- **`companyType` é obrigatório para CNPJ**, apesar de a doc listar como opcional.
- CPF/CNPJ e e-mail precisam ser **únicos** no ambiente (o CNPJ de exemplo da doc já está em uso no sandbox).
- Celular com dígitos repetidos (`11999999999`) é recusado.

---

## Fase 1 — Multi-tenant (`escola_id`)

**Objetivo:** transformar o portal single-school em multi-escola. **Maior bloco de esforço do projeto** e pré-requisito de tudo que vem depois.

**Estratégia:** `escola_id` **denormalizado** em toda tabela de domínio (não só nas raízes). Policies de RLS que sobem cadeia de joins são lentas e frágeis; com a coluna local a policy vira `escola_id = current_escola()`.

**Escopo real do schema (levantado em 2026-07-31):** 50 tabelas, sendo 13 backups `bkp_*` → **32 tabelas recebem `escola_id`**, `espetaculo` já tinha, `users` é legada/vazia e as 3 join tables de coreografia herdam pela `coreografia`.

| Etapa | Entrega | Status |
|---|---|---|
| 1.1 | Tabela `school` + seed DK Studio + `escola_id` nullable + backfill | ✅ 33 tabelas, 0 nulos |
| 1.2 | Contexto de tenant: `current_escola()` no banco + `escolaId` na sessão | ✅ |
| 1.3 | RLS por escola em todas as tabelas (`multitenant_04_rls.sql`) | ⏳ pronto p/ rodar |
| 1.4 | Converter os arquivos que usam admin client como contorno → cliente RLS | ✅ 207 → 33 queries |
| 1.5 | `escola_id` explícito no uso legítimo de admin (API do Pina, provisionamento) | ✅ |
| 1.6 | `NOT NULL` em `escola_id` (`scripts/multitenant_05_notnull.sql`) | ⏳ pronto p/ rodar |
| 1.7 | CRUD de escolas (cadastro/edição) | ⏳ |
| 1.9 | **Antes da 2ª escola:** token-store grava `escola_id` + remover fallback DK do default | ⏳ bloqueante |
| 1.8 | Tirar o hardcode do CONTRATADO no contrato (constante `DK` em `contracts/contract-view.tsx`) → vem da escola | ⏳ |

### Diagnóstico do isolamento (2026-07-31)

**207 das 362 queries (57%) usam o admin client, que ignora RLS.** Ajustar policies sozinho não protegeria o multi-escola. Causa raiz: **12 tabelas tinham RLS ligada e ZERO policy** — negavam tudo ao cliente normal, forçando o código a usar `service_role`:

`guardian_financial_contracts` (+items/versions) · `calendar_events` · `google_calendar_connections` · `growth_churn_events` · `enrollment_financial_records` · `class_teacher_rate` · `finance_provider_settings` · `dre_entries` · `churn_reasons` · `school`

Além disso, as policies existentes eram quase todas `using (true)` — qualquer autenticado via tudo.

**Decisão:** corrigir a RLS e reduzir o admin client ao uso legítimo (API do Pina autenticada por Firebase, provisionamento, `session.ts`, token store do Conta Azul), em vez de espalhar `.eq("escola_id")` por 207 pontos — que deixaria o isolamento dependendo de ninguém esquecer o filtro.

**Princípio das policies:** preservar o comportamento *dentro* da escola e adicionar só a fronteira de tenant. `SELECT` = escola inteira (qualquer papel); `WRITE` = admin/equipe da escola.

### Onde o admin client permanece (33 queries — piso legítimo)

| Local | Por quê |
|---|---|
| `api/pina/*` (13) | Autenticado por Firebase; não existe sessão Supabase |
| `token-store` Conta Azul (6) | Refresh de OAuth pode rodar fora de sessão |
| `pina/provision`, `auth`, `access-actions` (5) | Provisionamento de contas |
| `users/actions` (4) | `auth.admin.createUser/updateUserById` exigem service_role |
| `staff/actions` (4) | Criação de bucket de storage exige service_role |
| `session.ts` (1) | Resolve a própria sessão — ovo e galinha |

⚠️ **Estes ignoram a RLS** — o isolamento é explícito no código (feito na 1.5).

**Vazamentos que a 1.5 fechou:**
- `GET /api/pina/espetaculo/:id` servia qualquer espetáculo a quem soubesse o id, inclusive de outra escola (elenco completo). Agora valida contra a escola do token e responde 404.
- `GET /api/pina/meus-espetaculos`, ramo `master`, devolvia espetáculos de **todas** as escolas.
- `escolaId` nas claims do Firebase era `null` fixo — agora é assinado no SSO e no provisionamento. Sem escola na claim, a API **falha fechado**.
- `listUsers` listava perfis de todas as escolas; `updateUserProfile` e `toggleUserActive` alteravam por id sem checar escola.
- Criação de usuário gravava `escola_id` pelo fallback DK, não pela escola de quem cria.
- `resolvePinaViewer` casava professor por e-mail sem escopo de escola.
- `provisionAllPinaAction` provisionaria professores de todas as escolas.

**Premissa registrada:** o `token-store` do Conta Azul segue sem filtro de escola de propósito — é exclusivo do DK Studio (ADR 0001). Se uma segunda escola conectar o Conta Azul, aquelas queries precisam de `escola_id` antes (usam `maybeSingle()` e quebrariam).

### Achado de performance (2026-07-31)

Os logs acusaram **429 `over_request_rate_limit`** do Supabase Auth. Causa: cada componente de servidor chamava `auth.getUser()`, que faz uma chamada de rede à API de autenticação — uma página só disparava várias. Resolvido com `cache()` do React em `getAuthenticatedUser` e `getProfileByUserId`: uma chamada por request, independentemente de quantos componentes peçam. Isso seria um gargalo sério com várias escolas e usuários simultâneos.

> **Ordem importa:** 1.1 é aditiva (nullable, sem RLS) e não quebra o single-school. `NOT NULL` e RLS (1.4) só entram **depois** de 1.3, senão o sistema quebra em produção.

> **Não depende do Asaas.** Pode rodar 100% em paralelo à Fase 0.

---

## Fase 2 — Onboarding de escola + subconta (pós-contrato)

**Objetivo:** cada escola vira uma subconta Asaas com KYC próprio.

- 2.1 Promover o protótipo a feature real: criação de subconta gravando em `school`.
- 2.2 Fluxo de KYC via **URL dedicada** (modelo Subconta BaaS — cliente não acessa o painel do Asaas).
- 2.3 Estados de onboarding (pendente / em análise / aprovada / recusada) + reflexo na UI.
- 2.4 Guardar credenciais da subconta com segurança (nunca no repo; cofre/env).
- 2.5 Trocar sandbox → produção (`ASAAS_ENV=production`).

---

## Fase 3 — Entrada da escola + assinatura da plataforma (Fluxo 2)

> **Correção de ordem (2026-08-01).** Este bloco estava numerado como Fase 5, depois
> da cobrança dos alunos. Está errado: a assinatura é o que **libera o sistema** para
> a escola, e a subconta (Fase 2) é passo **opcional e posterior** — só existe se a
> escola quiser cobrar os alunos por aqui. A hierarquia real do negócio é:
>
> ```
> 1. escola cria conta no sistema
> 2. escola paga ASSINATURA à plataforma      <- libera o uso
> 3. escola usa a gestão (turmas, alunos, chamada…)
> 4. SE quiser cobrar aluno pelo sistema -> cria subconta   (Fase 2)
> 5. cobrança do aluno com split                            (Fase 4)
> ```

**Objetivo:** a escola é cliente do SaaS e paga assinatura fixa — cobrada na conta
da **própria plataforma**, nunca na subconta da escola e nunca misturada ao split.

| Etapa | Entrega | Status |
|---|---|---|
| 3.1 | Papel de dono da plataforma + área `/plataforma` separada | ✅ |
| 3.2 | Cadastro de escola nova (escola + primeiro admin + link de acesso) | ✅ |
| 3.3 | Planos (Mensal R$ 390 · Anual R$ 4.212) | ✅ |
| 3.4 | Assinatura recorrente na conta da plataforma | ✅ |
| 3.5 | **Webhook de conciliação** — status muda sozinho ao pagar | ✅ |
| 3.6 | Suspensão/reativação de acesso por inadimplência (carência de 5 dias) | ✅ |

**Validado ponta a ponta em 2026-08-01 (sandbox):** pagamento confirmado no
provedor → `PAYMENT_CONFIRMED` recebido → assinatura `pendente → ativa` em
2 segundos, sem intervenção.

### Armadilha do webhook (vivida, não teórica)

A fila foi **interrompida** antes do primeiro teste: o webhook foi criado no
provedor antes de a variável existir na Vercel, o endpoint respondeu erro e,
após 15 tentativas, o Asaas **pausou a entrega de todos os eventos** — em
silêncio. Religar exige ação manual (painel, ou `PUT /v3/webhooks/{id}` com
`interrupted: false`).

É exatamente por isso que o endpoint grava o evento **antes** de processar e
responde 2xx mesmo quando não consegue tratar: um bug no processamento não
pode derrubar a conciliação inteira. O evento fica salvo com o erro e pode ser
reprocessado.

---

## Fase 4 — Cobrança recorrente (Fluxo 1: escola → alunos)

**Objetivo:** mensalidade cai **direto na subconta da escola**, com a taxa da plataforma retida no split.

- 3.1 Contrato do aluno (`guardian_financial_contracts`) → assinatura recorrente na subconta da escola.
- 3.2 **Split** da % da plataforma — validar que o dinheiro nunca transita pela conta da DK (Art. 4º §4º e Art. 8º XIV da Res. 16).
- 3.3 **Pix Automático** como método principal.
- 3.4 Fallback obrigatório: boleto / Pix-cobrança (nem todo banco suporta Pix Automático).
- 3.5 ~~Cartão recorrente (opcional, secundário).~~ **Cancelado (ago/2026)** — repasse
  só após a liquidação da bandeira descasa o caixa da escola do pagamento do
  professor. Ver adendo no [ADR 0001](adr/0001-pagamentos-multiescola.md).
  - **Falta:** desabilitar cartão na configuração da subconta no Asaas. O
    código já não pede cartão, mas `UNDEFINED` oferece o que a CONTA tiver
    habilitado — enquanto isso não for feito, o cartão continua aparecendo
    na fatura para o responsável.

---

## Fase 4 — Webhooks e conciliação

- 4.1 Endpoint de webhook do Asaas (pago / atrasado / estornado / falha).
- 4.2 **Inadimplência com Asaas e sem Asaas** — ✅ feito. São dois mecanismos
  na mesma tela, e cada devedor carrega de onde veio:
  - `Atrasado no Asaas` — o webhook confirmou que venceu sem pagar. Dá para
    reenviar a cobrança.
  - `Sem baixa` — ninguém marcou na conciliação depois do vencimento. **Pode
    ser gente que pagou e não foi baixada**; a ação é conferir, não cobrar.
    Misturar os dois numa lista só faz a escola cobrar quem já pagou.

  **A regra é uma só: vencido e sem baixa é inadimplente.** A matrícula tem
  data de vencimento; chegou a data e ninguém disse que pagou, é inadimplente.

  Uma primeira versão desta tela tinha uma terceira categoria — matrícula
  "não acompanhada", fora da conta — para não acusar 663 famílias de calote no
  dia seguinte ao vencimento. **A leitura estava errada, e o Carlos corrigiu:**
  o silêncio não é ausência de informação, é a informação. O combinado é pagar
  no dia; não haver baixa depois do dia significa que não consta pagamento, e é
  isso que a escola precisa ver para ir atrás. Esconder atrás de "não
  acompanhada" transformava a lista num número bonito e inútil.

  O único caso que de fato não dá para julgar é matrícula **sem data de
  vencimento** — não é política, é aritmética. São 20, e aparecem separadas.

  **No dashboard**, o card traz o valor em atraso com a cobertura junto — não
  numa nota de rodapé. R$ 0 em atraso parece ótimo e pode significar que
  ninguém está acompanhando; um valor alto parece desastre e pode ser só falta
  de baixa. A linha de cobertura é o que separa as duas leituras.

  - **Falta:** régua de cobrança (lembrete automático antes e depois do
    vencimento) — só faz sentido para quem tem cobrança pelo sistema, e
    aparece com cadeado e motivo para quem não tem.

- 4.8 **Lançamentos futuros gerados na matrícula** (decisão do Carlos, ago/2026).
  Ao finalizar a matrícula, o sistema gera o contrato **com os lançamentos de
  todos os meses do período**. Cada lançamento tem valor, vencimento e status.

  ```
  matrícula fev→dez  →  11 lançamentos, um por mês
                        previsto → pago | vencido
  ```

  | | |
  |---|---|
  | **Manual** | o usuário dá baixa. Passou do vencimento sem baixa → inadimplente |
  | **Asaas** | o webhook dá baixa sozinho. Mesma regra, sem ninguém clicar |

  A origem muda **quem** dá a baixa, não a regra. Inadimplente é lançamento
  vencido e não pago, e ponto.

  **ISTO SUBSTITUI O DESENHO ATUAL.** Hoje `recebimento_manual` grava só o
  recebimento e a cobrança esperada é derivada de matrícula × competência —
  vem de `docs/faturamento-e-recebimento.md`, item 08, que decidiu **não**
  materializar para evitar "um cemitério de registros que ninguém preenche".

  O argumento cai quando os lançamentos nascem com a matrícula: some o estado
  "ninguém gerou ainda", que era o problema real. Foi ele que me obrigou a
  inventar `naoAcompanhadas` na tela de inadimplência — com lançamento
  materializado, essa categoria deixa de existir. **A spec precisa ser
  atualizada; hoje ela e o roadmap discordam.**

  **Tamanho, medido no banco (ago/2026):**

  | | |
  |---|---|
  | matrículas ativas | 665 |
  | média de meses por matrícula | 9,9 |
  | lançamentos a gerar | **7.270** — irrelevante para o Postgres |
  | matrículas **sem data de vencimento** | **656 de 665** ⚠️ |

  **O bloqueio era o vencimento, não o volume — e está resolvido.** 656
  matrículas não tinham `first_due_date`. O Carlos exportou o "Visão Contas a
  Receber" do Conta Azul e o dado veio de lá:
  `scripts/vencimento_01_importar.sql` preenche **636** delas, casando por CPF
  do responsável financeiro.

  **E o dado desmentiu o palpite.** A ideia era assumir "todo mundo dia 5". A
  planilha mostra 585 no dia 5 e **51 em outros dias** (10, 15, 8, 20, 4, 22).
  Assumir teria criado 51 cobranças na data errada — cada uma uma família
  recebendo boleto fora do combinado.

  Sobram **20**, que precisam de decisão caso a caso e não de palpite: 6 com
  responsável sem CPF no banco, 14 com CPF que não aparece na planilha (2
  delas com valor líquido zero, provavelmente bolsa integral). Somam
  R$ 5.724,00.

  O dia do vencimento, daqui para frente, ainda precisa de origem definida
  para matrícula NOVA: da escola (padrão 5), da matrícula, ou dos dois com a
  escola como fallback.

  **Decisões abertas:**
  - **Mudar o valor não reescreve lançamento já pago.** Reajuste vale do mês
    seguinte em diante; mês fechado fica como estava, senão o faturamento de
    junho deixa de bater com o que foi visto em junho. Mesma regra do 4.5.
  - **Cancelar matrícula cancela os lançamentos futuros**, não os passados.
  - **Troca de turma** com preço diferente ajusta os futuros. Ver 4.7 e 4.5.
  - Bolsista 100% gera lançamento de R$ 0 ou não gera? Lançamento zerado
    aparece como pago e some da inadimplência; não gerar deixa buraco no
    histórico. Recomendação: gerar com valor zero e status `isento`.
- 4.3 Conciliação → Growth & Churn.
- 4.4 Reflexo no status do contrato do aluno.
- 4.5 **Editar mensalidade e a cobrança acompanhar.** Hoje mudar o valor da
  matrícula regrava o item do contrato, mas **não mexe na assinatura já criada
  no Asaas** — a família continua sendo cobrada pelo valor antigo, e ninguém
  fica sabendo. Precisa de: alterar o valor na matrícula → recalcular o item e
  o total do contrato → `PUT /subscriptions/{id}` com o novo valor → confirmar
  que voltou certo. Vale para desconto concedido, bolsa, troca de turma com
  preço diferente e reajuste anual.
  - Cobrança **já emitida e ainda não paga** também precisa de decisão: atualiza
    a existente ou cancela e emite outra? Reajuste no meio do mês sem essa
    regra gera duas cobranças para a mesma competência.
  - Registrar quem mudou e quando. Alteração de valor é ato financeiro; sem
    log, a divergência de amanhã não tem dono.
- 4.6 **Conta apagada no Asaas não avisa — e não tem como avisar.** O webhook é
  registrado DENTRO da subconta, então ele morre junto com ela: uma conta
  apagada não consegue notificar a própria morte. E o webhook da subconta só
  escuta `PAYMENT_*`, sem nenhum evento de conta.
  - **Feito:** rejeição da chave (401/403) na consulta de status agora grava
    `kyc_status = 'revogada'` e a tela para de mostrar "Aprovada" para uma
    conta que não existe mais.
  - **Falta:** varredura periódica. Hoje a detecção só acontece quando alguém
    abre a tela da conta — uma escola que nunca abre fica com o estado velho.
  - **Falta avaliar:** webhook na conta-MÃE, que sobrevive à exclusão da
    subconta. Confirmar com o Asaas se existe evento de conta nesse nível.

- 4.7 **Catálogo de mensalidades — escolher produto em vez de digitar valor.**
  Na matrícula, em vez de escrever mensalidade e desconto à mão, seleciona-se
  um produto já cadastrado (ex.: `1× semana`, `2× semana`, `2× semana com
  desconto família`). O valor vem do produto.

  **O tamanho do problema, medido no banco (ago/2026):**

  | | |
  |---|---|
  | matrículas ativas | 665 |
  | preços cheios DISTINTOS | **16** |
  | valores de desconto distintos | 26 |
  | combinações preço+desconto | 52 |
  | motivos de desconto distintos | 4 |

  Ou seja: o valor é digitado 665 vezes para existirem 16 preços de verdade.
  Cada digitação é uma chance de errar um dígito, e o erro só aparece quando a
  família recebe a cobrança.

  **O que isso conserta, além da digitação:**

  - **A pergunta "quem tem desconto?" passa a ter resposta.** Hoje há 26
    valores de desconto diferentes para 4 motivos declarados — o "quanto" é
    ad hoc e o "porquê" é rótulo genérico. 266 matrículas dizem
    `Desconto familia/2a matricula (15%)` e o desconto real vai de **5,3% a
    77,9%**. Com produto, desconto vira item de catálogo: um nome, um valor,
    e quem usa aparece numa lista.
  - **Reajuste anual vira uma edição, não 665.** Mudar o preço do produto
    propaga — e aí encosta no 4.5, que é fazer a cobrança no Asaas acompanhar.
  - **Faturamento por produto**, que hoje não existe: dá para responder
    quanto vem de cada modalidade sem cruzar planilha.

  **Decisões que ficam em aberto:**

  - **O produto é da escola, não da plataforma.** Multi-escola: cada uma tem
    a própria tabela de preços, e um catálogo global obrigaria todas ao mesmo
    valor.
  - **Preço muda; matrícula antiga não pode mudar junto.** A matrícula precisa
    guardar o valor VIGENTE quando foi feita, senão um reajuste reescreve o
    passado e o faturamento de junho deixa de bater com o que foi visto em
    junho. O produto é a origem no momento da escolha, não uma referência viva.
  - **Exceção continua existindo.** Bolsa integral, acordo pontual, valor
    negociado — o campo livre não some, vira a exceção declarada em vez do
    caminho padrão. Hoje é o contrário.
  - **Migração das 665 existentes:** as 52 combinações preço+desconto mapeiam
    para o catálogo. O que não encaixar vira exceção explícita, não some.

  Depende de nada; pode vir antes da cobrança em produção — e vindo antes,
  evita migrar 665 valores digitados à mão para dentro do Asaas.

---

## Fase 6 — Conformidade contínua e desligamento do Conta Azul

- 6.1 **Selo Asaas** — ✅ feito. Arte oficial (`public/asaas/`, byte a byte a
  do CDN do Asaas) no rodapé do `AppShell` e do layout da plataforma, e no card
  da conta de pagamentos. Ficou no shell e não em cada tela: são quinze telas
  com valores, e repetir a marcação garantiria que a décima sexta nascesse sem
  o selo. No portal só aparece para escola com `usa_pagamentos` — quem não
  cobra pelo sistema não tem serviço financeiro prestado.
  - Arquivos locais e não a URL do CDN: `baas.asaas.com/selos/…` responde
    `AccessDenied` sem o parâmetro `id`, e selo que some é violação silenciosa.
  - O `id` identifica a conta mas **não** muda a arte (verificado por hash: um
    id inventado devolve o mesmo arquivo). A conta aprovada é
    `ba89535e-9857-4a97-87a4-eb41eb6076e7`.
  - **Pendente de decisão:** o selo no contrato aluno↔escola. O documento
    exibe valores, mas a Cláusula Terceira é genérica de propósito e não cita
    o provedor. Alterar documento assinado é decisão jurídica — ver 6.2.
  - **Pendente:** preencher o formulário de homologação do Asaas, que segundo
    o suporte só deve ser enviado depois da implementação de fato.
- 6.2 **Cláusula contratual** obrigatória no contrato DK↔escola (modelo no Playbook, pág. 11).
- 6.6 **[BUG, corrigido em `scripts/contrato_01_desconto.sql`]** O item do
  contrato nascia com a mensalidade CHEIA: a função
  `ensure_guardian_financial_contract_item` gravava `monthly_amount` sem
  subtrair `discount_amount`. A família com desconto era cobrada como se não
  tivesse. São 301 matrículas ativas com desconto, R$ 34.832/mês — pequeno
  hoje, com 9 itens; 301 famílias pagando a mais no dia em que as 666
  cobranças forem geradas. Falta rodar o script e decidir sobre os itens
  antigos (o bloco de recálculo vem comentado no fim dele).
- 6.7 **Tela de Resultado — gráficos.** Página própria com a leitura visual do
  financeiro: faturamento contratado, cobertura de cobrança, recebido e
  inadimplência ao longo do tempo. Quais gráficos exatamente, o Carlos define
  depois. Duas regras que já valem, herdadas do que já quebrou aqui:
  - **Nenhum recebimento sem a linha de cobertura.** Recebido contra o
    faturamento total faz uma escola com poucos contratos no sistema parecer
    99% inadimplente (`docs/faturamento-e-recebimento.md`, item 03).
  - **Contratado e recebido nunca dividem eixo nem rótulo.** São dinheiro
    esperado e dinheiro entrado; um gráfico que soma os dois não significa
    nada.
- 6.3 Copy da taxa: sempre "taxa da plataforma/comissão", **nunca** "tarifa de Pix/bancária" (Art. 8º XI).
- 6.4 Canais de suporte do Asaas visíveis ao cliente final.
- 6.5 Desligar Conta Azul no multi-escola (permanece só enquanto for single-school).

---

## Dependências

```
Fase 0 (regulatório) ──────────────┐
                                   ├──> Fase 3 (assinatura) ──> Fase 4 ──> Fase 5
Fase 1 (multi-tenant) ─────────────┘        │
                                            └──> Fase 2 (subconta) é OPCIONAL
                                                 e só necessária para a Fase 4
```

- Fases 0 e 1 são **paralelas e independentes**.
- **Fase 3 é o caminho principal**: sem assinatura, a escola não usa o sistema.
- **Fase 2 (subconta) é um ramo opcional** — só a escola que quiser cobrar os
  alunos por aqui precisa dela. Foi construída antes por engano de ordenação,
  mas está pronta e não atrapalha.
- Fase 6 acompanha tudo a partir da Fase 2.

## Ambiente de testes — limites conhecidos

A conta de desenvolvimento permite testar **sem depender da aprovação do BaaS**:
até ~10 subcontas e volume limitado (na ordem de R$ 2.000). Suficiente para
validar assinatura, subconta, cobrança e split ponta a ponta.

## Riscos

| Risco | Mitigação |
|---|---|
| Asaas pedir ajuste no modelo na análise | Fase 1 é agnóstica ao provedor. A conta de desenvolvimento permite validar tudo antes da aprovação (ver limites acima) |
| Pix Automático sem suporte em todo banco | Fallback boleto/Pix-cobrança é obrigatório (3.4) |
| Tributação da taxa de split mal enquadrada | Validação contábil na 0.7, **antes** de assinar |
| Redação errada da cobrança (parecer tarifa bancária) | 6.3 — revisar copy de contrato e telas |
| Multi-tenant tocar todo o schema e quebrar o single-school | Backfill (1.5) + RLS (1.3) testados antes de qualquer feature nova |

## Sem prazo de adequação

Art. 22 da Res. 16/2025 dá prazo (até 31/12/2026) **só para contrato já vigente** antes da norma. Contrato novo nasce sob a regra atual — a conformidade (selo, cláusula, copy) precisa estar pronta **no dia 1 da operação**.
