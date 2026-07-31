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
| 0.3 | Preencher e enviar o Checklist BaaS (Google Forms do Asaas) | ⏳ |
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

- 1.1 Tabela `school` (razão social, CNPJ, endereço, contatos, status KYC, `asaas_account_id`, `asaas_wallet_id`).
- 1.2 Propagar `escola_id` por todo o schema (alunos, turmas, matrículas, staff, financeiro, espetáculos, personagens…).
- 1.3 RLS por escola — isolamento total entre tenants.
- 1.4 Resolver a escola do usuário na sessão (contexto de tenant).
- 1.5 Backfill: DK Studio vira a primeira `school`; dados atuais recebem seu `escola_id`.
- 1.6 Tirar o hardcode do CONTRATADO no contrato do aluno (constante `DK` em `contracts/contract-view.tsx`) → passa a vir da escola.

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
