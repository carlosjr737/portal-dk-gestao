# ADR 0001 — Arquitetura de pagamentos no modelo multi-escola (SaaS)

- **Status:** Proposto (decisão de arquitetura para a fase multi-tenant; ainda não implementado)
- **Data:** Julho/2026
- **Contexto do repo:** hoje o sistema é single-school (DK Studio) e usa **Conta Azul** como ERP/cobrança. Este ADR define o rumo para quando o portal atender **várias escolas**.

## Contexto

Ao virar SaaS multi-escola, a plataforma precisa cobrar **mensalidades recorrentes** dos alunos de cada escola. A pergunta central não é "qual gateway", e sim: **quem recebe/custodia o dinheiro?**

Se a plataforma recebe tudo numa conta única e repassa, ela vira, na prática, **instituição de pagamento** (regulada pelo BACEN) — com risco jurídico, tributário e de fluxo de caixa (o dinheiro das escolas transita por ela). Isso deve ser evitado.

## Decisão

1. **Sub-conta por escola + split.** Cada escola tem uma **sub-conta (sub-merchant) com KYC próprio** no provedor de pagamento. O dinheiro das mensalidades cai **direto na sub-conta da escola**; a **taxa da plataforma é retida automaticamente via split**. A plataforma **nunca custodia** o dinheiro de terceiros.

2. **Dois fluxos de cobrança separados** (não misturar):
   - **Fluxo 1 — Escola → alunos (com a % da plataforma):** cobrança recorrente na sub-conta da escola; split retém a % da plataforma; o restante fica com a escola.
   - **Fluxo 2 — Plataforma → escola (assinatura fixa):** a escola é cliente do SaaS e paga uma **assinatura recorrente própria**, cobrada na conta da plataforma, **independente do split**.
   - Modelo de receita = **híbrido**: `% por transação (Fluxo 1)` + `assinatura fixa por escola (Fluxo 2)`.

3. **Método principal: Pix Automático** (débito recorrente autorizado uma vez pelo pagador), com **Boleto / Pix-cobrança como fallback** e **cartão recorrente** como opção secundária.

4. **Conta Azul é eliminado no multi-escola.** O papel de cobrança/emissão/recebimento passa a ser do provedor de pagamento (sub-conta + split). O Conta Azul permanece apenas enquanto o sistema for single-school; não faz split de plataforma e não escala para o modelo SaaS.

5. **Provedor recomendado:** **Asaas** (Pix/Pix Automático forte, sub-contas com KYC, split nativo, baixo custo, comum em educação). Alternativa: **Iugu** (recorrência/marketplace mais parrudos). Pagar.me como opção de escala de marketplace no futuro.

## Diagrama do Fluxo 1

```
Aluno autoriza Pix Automático (1x)
   -> cobrança mensal automática cai na SUB-CONTA da escola
   -> split retém a % da plataforma; restante fica com a escola
   -> webhook "pago/atrasado" -> concilia no sistema
        (inadimplência, Growth & Churn, status do contrato)
```

## Consequências

**Positivas**
- Plataforma fora do escopo de instituição de pagamento (sem custódia).
- Pix Automático derruba inadimplência (cobra sozinho, sem boleto "esquecido") e elimina churn de cartão vencido.
- Receita da plataforma (%) é retida no split, sem processo manual de cobrança.
- Cada escola recebe seu dinheiro direto — transparência e menos atrito.

**Negativas / riscos**
- Onboarding com KYC por escola (sub-merchant) adiciona fricção no cadastro da escola.
- Pix Automático ainda em adoção (lançado em 2025); nem todo banco do pagador suporta 100% → o fallback (boleto/Pix-cobrança) é obrigatório.
- Dependência do provedor escolhido (lock-in parcial da camada de cobrança).

## Impacto no sistema (quando implementar)

- **Nova entidade `school`/tenant** com `provider_subaccount_id` e status de KYC.
- O **contrato do aluno** (já modelado: `guardian_financial_contracts` com total, `first_due_date`, itens/parcelas) passa a virar uma **assinatura recorrente na sub-conta da escola**, trocando o sync do Conta Azul pelo provedor.
- **Webhooks** de pagamento alimentam inadimplência e Growth & Churn.
- **Billing da plataforma (Fluxo 2)** = módulo separado (assinatura por escola).
- Dados do CONTRATADO no contrato passam a vir da escola cadastrada (ver constante `DK` em `src/features/contracts/contract-view.tsx`, hoje hardcoded).

## A validar antes de codar

- Config exata do **split**: exigir que o dinheiro caia **direto na sub-conta** da escola (não roteie pela conta da plataforma, nem por um instante) — é o que mantém a plataforma fora do escopo regulatório.
- Processo de **KYC/onboarding do sub-merchant** de cada provedor.
- Regras de **Pix Automático** por banco e limites.
- Validação jurídica/contábil do arranjo (custódia, split, tributação da taxa).

> Observação: este ADR é decisão de arquitetura, não aconselhamento jurídico/regulatório. O desenho de split e KYC deve ser confirmado com o provedor e com contador/advogado.
