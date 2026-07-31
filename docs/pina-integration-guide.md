# Integração Pina ↔ Portal DK — Guia para o dev do Pina

Este documento descreve **como o Pina consome os dados do espetáculo** e **como o professor entra sem segundo login (SSO)**.

- **Portal (fonte da verdade):** coreografias, turmas, professores, músicas, elenco, personagens.
- **Pina (Firebase):** lê esses dados e grava as formações do lado dele.
- **Base da API:** `https://portal-dk-gestao.vercel.app/api/pina`
- **Firebase project (SSO):** `pinaform-a5fec`
- **Origin liberado no CORS:** `https://www.pinaform.app`

---

## 1. Fluxo geral (SSO + leitura)

```
[Portal] professor clica "Abrir no Pina"
   → POST /api/pina/sso-token (sessão do portal)      → { token }   (custom token Firebase)
   → abre  https://www.pinaform.app?token=<token>&espetaculoId=<id>&coreografiaId=<id?>

[Pina] recebe ?token= na URL
   → firebase.auth().signInWithCustomToken(token)      → sessão Firebase
   → user.getIdToken()                                 → <idToken>
   → GET /api/pina/espetaculo/<espetaculoId>
        header: Authorization: Bearer <idToken>        → JSON com as coreografias
```

O **portal** cria o custom token; o **Pina** troca por sessão Firebase e usa o **ID token** nas chamadas à API. **Não** use token do Supabase (o Pina não tem sessão Supabase, e ele expira sem poder renovar).

---

## 2. Recebendo o token (query params na abertura)

Quando o portal abre o Pina, manda:

| Param | Descrição |
|---|---|
| `token` | custom token do Firebase (use em `signInWithCustomToken`) |
| `espetaculoId` | id do espetáculo a exibir |
| `coreografiaId` | (opcional) coreografia específica pra abrir direto |

Exemplo no Pina:

```ts
const params = new URLSearchParams(window.location.search);
const customToken = params.get("token")!;
const espetaculoId = params.get("espetaculoId")!;

import { getAuth, signInWithCustomToken } from "firebase/auth";
const auth = getAuth(); // app do projeto pinaform-a5fec
const cred = await signInWithCustomToken(auth, customToken);
const idToken = await cred.user.getIdToken();
```

### Claims dentro do token
O custom token é assinado pelo portal com estas claims (disponíveis no ID token):

| Claim | Valor |
|---|---|
| `uid` | id do professor no portal (`staff_members.id`); para master sem cadastro de professor, é o id do perfil |
| `role` | `"master"` (admin/equipe) ou `"professor"` |
| `professorId` | `staff_members.id` do professor, ou `null` |
| `escolaId` | `null` por enquanto (reservado para o multi-escola) |

> O `uid` bate com o id do professor no portal — use-o para casar os dados dos dois lados.

---

## 3. API de leitura

### `GET /api/pina/espetaculo/:espetaculoId`

**Header obrigatório:**
```
Authorization: Bearer <firebase ID token>
```

**Exemplo:**
```ts
const res = await fetch(
  `https://portal-dk-gestao.vercel.app/api/pina/espetaculo/${espetaculoId}`,
  { headers: { Authorization: `Bearer ${idToken}` } },
);
const data = await res.json();
```

**Resposta 200 (contrato — estes nomes de campo são estáveis):**
```json
{
  "espetaculo": { "id": "uuid", "nome": "Festival 1 / 2026" },
  "personagens": [
    { "id": "uuid", "nome": "Morticia", "cor": "#8b5cf6", "alunoId": "uuid" },
    { "id": "uuid", "nome": "Wandinha", "cor": "#22c55e", "alunoId": null }
  ],
  "coreografias": [
    {
      "id": "uuid",
      "nome": "Ressurreição de los muertos",
      "tipo": "normal",                       // normal | flashmob | flashfinal | especial
      "musicaTexto": "Everybody - Backstreet Boys",
      "audioUrl": null,
      "duracaoSegundos": null,
      "ordem": 2,
      "turmas":      [ { "id": "uuid", "nome": "Danças Urbanas - ..." } ],
      "professores": [ { "id": "uuid", "nome": "Dener" } ],
      "elenco":      [ { "alunoId": "uuid", "nome": "Ana ..." } ]
    }
  ]
}
```

- **`personagens`** são os papéis **deste espetáculo** (cada espetáculo tem os seus) — o portal é a fonte da verdade; o Pina só **consome**. Campos: `id`, `nome`, `cor` (hex, identidade visual no palco) e `alunoId` (o aluno que interpreta o papel, ou `null` se for papel livre). A lista vem no **nível do espetáculo**, não por coreografia, porque o mesmo personagem pode aparecer em várias.
- **`elenco`** já vem **resolvido pelo backend** (alunos das turmas via matrículas ativas **+** elenco manual das coreografias tipo `especial`). O Pina **não** precisa conhecer o schema interno.
- **LGPD:** de aluno só expomos **`alunoId` + `nome`**; de personagem só **`id`, `nome`, `cor`, `alunoId`**. Nada sensível.

**Códigos de erro:**
| Código | Significado |
|---|---|
| `401 unauthorized` | token ausente/ inválido/ expirado |
| `404 not_found` | espetáculo não existe |
| `503 firebase_not_configured` | integração não configurada no portal (avisar o dev do portal) |

---

## 4. Visibilidade (o que cada um vê)

A mesma API, filtrada pelas claims do token:

- **`role: "master"`** → vê **todas** as coreografias do espetáculo.
- **`role: "professor"`** → vê **apenas** as coreografias em que ele aparece como professor (`professorId`).

Ou seja: o Pina não precisa filtrar nada — a API já devolve só o que o usuário pode ver.

---

## 5. Endpoints (resumo)

| Método | Rota | Auth | Retorno |
|---|---|---|---|
| `POST` | `/api/pina/sso-token` | sessão do portal (chamado pelo portal) | `{ token }` |
| `GET` | `/api/pina/espetaculo/:id` | `Authorization: Bearer <firebase ID token>` | JSON acima |

CORS liberado para `https://www.pinaform.app` (GET + OPTIONS).

---

## 6. Boas práticas

- **Renovação:** o Firebase SDK renova o ID token sozinho. Sempre pegue com `user.getIdToken()` na hora da chamada (ele devolve um token válido).
- **Sessão:** depois do `signInWithCustomToken`, a sessão Firebase persiste; não precisa reabrir pelo portal a cada chamada.
- **IDs de teste:** peça ao dev do portal os `espetaculoId` de teste (ex.: os dois festivais já cadastrados).
