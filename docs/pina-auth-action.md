# Pina — página `/auth/action` (definir senha)

Página que o **Pina** hospeda para tratar o link de acesso que o **portal** envia ao professor.
Arquivo pronto: [`pina-auth-action.html`](./pina-auth-action.html).

## Como o link chega
O portal gera (sem `actionCodeSettings`, então **não precisa** de Custom Action URL nem domínio autorizado no Firebase):

```
https://www.pinaform.app/auth/action?mode=resetPassword&oobCode=<código>&continueUrl=<url>
```

- `mode` — tipo da ação (`resetPassword` no fluxo de acesso do professor).
- `oobCode` — código de uso único do Firebase (extraído pelo portal).
- `continueUrl` — pra onde voltar depois de salvar a senha (hoje a raiz do Pina, onde o professor vê a lista dele).

## O que o dev precisa fazer
1. Servir o arquivo em `https://www.pinaform.app/auth/action`
   - **App Vite/React/Vue:** vira uma rota `/auth/action` que porta a lógica do `<script>` (imports do `firebase/auth` do próprio bundle, reusando o `getAuth()` já existente).
   - **Estático:** pode subir o HTML como está.
2. Preencher `firebaseConfig` (`apiKey`, `appId`) com os valores do app web do Pina
   (Console → Configurações do projeto → Seus apps → SDK). São **públicos** — não é o service account.
3. Ajustar branding (logo/cores) — hoje está com um placeholder roxo "P".

## Funções do Firebase usadas
- `verifyPasswordResetCode(auth, oobCode)` → valida o código e retorna o e-mail.
- `confirmPasswordReset(auth, oobCode, novaSenha)` → grava a nova senha.
- `applyActionCode` / `checkActionCode` → para `verifyEmail`/`recoverEmail` (a página trata caso o Firebase mande outros tipos de e-mail pra mesma URL).

## Tratamento de erros já embutido
`auth/expired-action-code`, `auth/invalid-action-code`, `auth/user-disabled`, `auth/user-not-found`,
`auth/weak-password`, senhas que não coincidem, link sem `oobCode`.
