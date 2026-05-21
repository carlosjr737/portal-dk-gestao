# Integração financeira

Esta pasta define uma camada de abstração para integração financeira do Portal DK Gestão.

O objetivo é permitir usar Conta Azul agora e trocar por outro provedor no futuro sem espalhar chamadas específicas pelo portal.

## Provider de inadimplência

A interface principal é `FinanceProvider`, em:

`src/features/finance/providers/finance-provider.ts`

Métodos iniciais:

- `getProviderName()`
- `getOverdueReceivables(params)`
- `getCustomerByDocument(document)`
- `getCustomers(params)`

O primeiro foco da integração é inadimplência. Por isso o tipo principal de cobrança é `OverdueReceivable`.

## Como trocar o provider

Configure a variável de ambiente:

```env
FINANCE_PROVIDER=mock
```

Valores aceitos:

- `none`: integração desativada, retorna listas vazias.
- `mock`: usa dados locais de exemplo.
- `conta_azul`: usa a estrutura do provider Conta Azul. No momento, ainda não faz chamadas reais e retorna erro claro.

Se `FINANCE_PROVIDER` estiver vazio em desenvolvimento, o portal usa `mock`.

A seleção acontece em:

`src/features/finance/providers/finance-provider-factory.ts`

## Como usar o mock

Use:

```env
FINANCE_PROVIDER=mock
```

O mock retorna clientes e recebíveis vencidos fictícios para testar telas de inadimplência sem chamar um sistema externo.

## Conta Azul futuramente

Use:

```env
FINANCE_PROVIDER=conta_azul
CONTA_AZUL_BASE_URL=https://api-v2.contaazul.com
CONTA_AZUL_AUTH_URL=https://auth.contaazul.com/login
CONTA_AZUL_TOKEN_URL=https://auth.contaazul.com/oauth2/token
CONTA_AZUL_CLIENT_ID=
CONTA_AZUL_CLIENT_SECRET=
CONTA_AZUL_REDIRECT_URI=http://localhost:3000/api/integrations/conta-azul/callback
SUPABASE_SERVICE_ROLE_KEY=
```

O provider Conta Azul usa a API v2 oficial, sempre server-side:

- Base da API: `CONTA_AZUL_BASE_URL` ou, se vazio, `https://api-v2.contaazul.com`
- Inadimplência/contas a receber vencidas: `GET /v1/financeiro/eventos-financeiros/contas-a-receber/buscar`
- Clientes/pessoas: `GET /v1/pessoas`

## OAuth Conta Azul

Rotas internas:

- `GET /api/integrations/conta-azul/connect`: inicia OAuth e redireciona para a Conta Azul.
- `GET /api/integrations/conta-azul/callback`: recebe `code`, troca por tokens e salva a conexão.

Tokens são salvos server-side em `integration_connections`, acessada apenas com `SUPABASE_SERVICE_ROLE_KEY`.

O client da Conta Azul busca `access_token` no token-store. Se a API retornar `401`, chama `refreshContaAzulAccessToken()`, salva o novo token e repete a requisição uma única vez.

Para inadimplência, o provider consulta contas a receber com `status=OVERDUE`, filtros `data_vencimento_de` e `data_vencimento_ate`, e paginação `pagina`/`tamanho_pagina`.

Como o endpoint de contas a receber retorna apenas `cliente.id` e `cliente.nome`, os clientes sao enriquecidos em lote com `/v1/pessoas` usando:

- `ids`: lista de `cliente.id` separados por virgula
- `tipo_perfil`: `Cliente`
- `pagina`: `1`
- `tamanho_pagina`: `1000`

O provider coleta `cliente.id` unicos, divide em lotes de 100 IDs e monta um `Map` por `person.id`. Futuramente podemos persistir `conta_azul_person_id` em `guardians` para vinculo direto por UUID da Conta Azul, sem depender de CPF/CNPJ em toda consulta.

Se `CONTA_AZUL_ACCESS_TOKEN` não estiver configurado, a integração retorna:

`CONTA_AZUL_ACCESS_TOKEN não configurado.`

Se a API retornar `401`, a integração retorna:

`Token da Conta Azul expirado ou inválido.`

Se o refresh falhar, a conexão é marcada como expirada e a tela pede reconexão.

## Variáveis da Conta Azul

Variáveis previstas:

```env
FINANCE_PROVIDER=conta_azul
CONTA_AZUL_BASE_URL=https://api-v2.contaazul.com
CONTA_AZUL_AUTH_URL=https://auth.contaazul.com/login
CONTA_AZUL_TOKEN_URL=https://auth.contaazul.com/oauth2/token
CONTA_AZUL_CLIENT_ID=
CONTA_AZUL_CLIENT_SECRET=
CONTA_AZUL_REDIRECT_URI=
```

## Segurança

As credenciais da Conta Azul devem ficar apenas no servidor. `CONTA_AZUL_CLIENT_SECRET`, `CONTA_AZUL_ACCESS_TOKEN` e `CONTA_AZUL_REFRESH_TOKEN` são sensíveis.

Não use `NEXT_PUBLIC_` para secrets da Conta Azul. Variáveis com `NEXT_PUBLIC_` são expostas ao navegador.

Os providers usam `server-only` para evitar import acidental em client components.
