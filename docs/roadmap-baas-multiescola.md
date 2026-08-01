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

## Fase 3 — Cobrança recorrente (Fluxo 1: escola → alunos)

**Objetivo:** mensalidade cai **direto na subconta da escola**, com a taxa da plataforma retida no split.

- 3.1 Contrato do aluno (`guardian_financial_contracts`) → assinatura recorrente na subconta da escola.
- 3.2 **Split** da % da plataforma — validar que o dinheiro nunca transita pela conta da DK (Art. 4º §4º e Art. 8º XIV da Res. 16).
- 3.3 **Pix Automático** como método principal.
- 3.4 Fallback obrigatório: boleto / Pix-cobrança (nem todo banco suporta Pix Automático).
- 3.5 Cartão recorrente (opcional, secundário).

---

## Fase 4 — Webhooks e conciliação

- 4.1 Endpoint de webhook do Asaas (pago / atrasado / estornado / falha).
- 4.2 Conciliação → inadimplência.
- 4.3 Conciliação → Growth & Churn.
- 4.4 Reflexo no status do contrato do aluno.

---

## Fase 5 — Billing da plataforma (Fluxo 2: DK → escola)

**Objetivo:** a escola é cliente do SaaS e paga assinatura fixa — **separado do split**, nunca misturado.

- 5.1 Planos/assinatura por escola.
- 5.2 Cobrança na conta da própria DK (não na subconta da escola).
- 5.3 Suspensão/reativação por inadimplência da escola.

---

## Fase 6 — Conformidade contínua e desligamento do Conta Azul

- 6.1 **Selo Asaas** em toda tela que movimente/exiba valores (mapear todas) — trocar o placeholder pela URL oficial do CDN.
- 6.2 **Cláusula contratual** obrigatória no contrato DK↔escola (modelo no Playbook, pág. 11).
- 6.3 Copy da taxa: sempre "taxa da plataforma/comissão", **nunca** "tarifa de Pix/bancária" (Art. 8º XI).
- 6.4 Canais de suporte do Asaas visíveis ao cliente final.
- 6.5 Desligar Conta Azul no multi-escola (permanece só enquanto for single-school).

---

## Dependências

```
Fase 0 (regulatório) ──────────────┐
                                   ├──> Fase 2 ──> Fase 3 ──> Fase 4 ──> Fase 5
Fase 1 (multi-tenant) ─────────────┘
                                        Fase 6 corre em paralelo a partir da Fase 2
```

- Fases 0 e 1 são **paralelas e independentes**.
- Fase 2 exige **as duas** concluídas.
- Fase 6 acompanha tudo a partir da Fase 2.

## Riscos

| Risco | Mitigação |
|---|---|
| Asaas pedir ajuste no modelo na análise | Não construir Fase 2+ antes da aprovação; Fase 1 é agnóstica ao provedor |
| Pix Automático sem suporte em todo banco | Fallback boleto/Pix-cobrança é obrigatório (3.4) |
| Tributação da taxa de split mal enquadrada | Validação contábil na 0.7, **antes** de assinar |
| Redação errada da cobrança (parecer tarifa bancária) | 6.3 — revisar copy de contrato e telas |
| Multi-tenant tocar todo o schema e quebrar o single-school | Backfill (1.5) + RLS (1.3) testados antes de qualquer feature nova |

## Sem prazo de adequação

Art. 22 da Res. 16/2025 dá prazo (até 31/12/2026) **só para contrato já vigente** antes da norma. Contrato novo nasce sob a regra atual — a conformidade (selo, cláusula, copy) precisa estar pronta **no dia 1 da operação**.
