# Portal DK Gestao

Sistema interno para gestao do DK Studio, uma escola de danca e producao artistica.

## Stack

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Supabase client configurado

## Requisitos

- Node.js 20 ou superior
- npm, pnpm, yarn ou bun

## Como rodar

Instale as dependencias:

```bash
npm install
```

Crie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

Preencha as variaveis do Supabase em `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Estrutura

```text
src/
  app/
    dashboard/
    alunos/
    responsaveis/
    turmas/
    matriculas/
    financeiro/
    configuracoes/
  components/
    layout/
  lib/
    supabase/
```

## Rotas iniciais

- `/dashboard`
- `/alunos`
- `/responsaveis`
- `/turmas`
- `/matriculas`
- `/financeiro`
- `/configuracoes`

## Supabase

O projeto possui helpers para criar clientes Supabase no browser e no servidor:

- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`

Nao use chaves reais no codigo; mantenha credenciais apenas em `.env.local`.

## Primeiro admin

O Portal DK usa Supabase Auth com e-mail e senha. Para criar o primeiro acesso
administrativo:

1. Crie o usuario no Supabase Auth.
2. Copie o `id` do usuario criado.
3. Insira ou atualize o perfil em `public.profiles`:

```sql
insert into public.profiles (id, name, email, role, active)
values (
  'ID_DO_AUTH_USER',
  'Administrador',
  'admin@dkstudio.com',
  'admin',
  true
)
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  active = excluded.active,
  updated_at = now();
```
# portal-dk-gestao
