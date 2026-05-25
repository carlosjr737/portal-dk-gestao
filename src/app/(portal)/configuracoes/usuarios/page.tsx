import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { roleLabels, type UserRole } from "@/features/auth/permissions";
import {
  createUser,
  listUsers,
  resetUserPassword,
  toggleUserActive,
  updateUserProfile,
  type PortalUser,
  type UserFilters,
} from "@/features/users/actions";

export const dynamic = "force-dynamic";

type UsuariosPageProps = {
  searchParams?: Promise<{
    search?: string;
    role?: string;
    status?: string;
    mode?: string;
    edit?: string;
    reset?: string;
    success?: string;
    error?: string;
  }>;
};

const roles: UserRole[] = ["admin", "equipe", "professor"];

export default async function UsuariosPage({ searchParams }: UsuariosPageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const allUsers = await listUsers();
  const users = hasFilters(filters) ? await listUsers(filters) : allUsers;
  const editingUser = users.find((user) => user.id === params?.edit) ?? null;
  const resetUser = users.find((user) => user.id === params?.reset) ?? null;
  const showCreateForm = params?.mode === "new";
  const stats = getStats(allUsers);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Usuários"
          description="Crie usuários, defina perfis de acesso e controle quem pode entrar no Portal DK."
        />
        <Link
          href="/configuracoes/usuarios?mode=new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Novo usuário
        </Link>
      </div>

      <Message type="success" message={params?.success} />
      <Message type="error" message={params?.error} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total de usuários" value={stats.total} />
        <StatCard label="Admins" value={stats.admins} />
        <StatCard label="Equipe" value={stats.equipe} />
        <StatCard label="Professores" value={stats.professores} />
        <StatCard label="Inativos" value={stats.inativos} />
      </section>

      {showCreateForm ? <CreateUserForm /> : null}
      {editingUser ? <EditUserForm user={editingUser} /> : null}
      {resetUser ? <ResetPasswordForm user={resetUser} /> : null}

      <form className="grid gap-3 rounded-md border border-border bg-white p-4 md:grid-cols-4">
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-foreground">Buscar</span>
          <input
            name="search"
            defaultValue={filters.search}
            placeholder="Nome ou e-mail"
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Perfil</span>
          <select
            name="role"
            defaultValue={filters.role ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
          >
            <option value="">Todos</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Status</span>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
          >
            <option value="">Todos</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </label>

        <div className="flex items-end gap-2 md:col-span-4">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Filtrar
          </button>
          <Link
            href="/configuracoes/usuarios"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Limpar
          </Link>
        </div>
      </form>

      <section className="overflow-hidden rounded-md border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">E-mail</th>
                <th className="px-4 py-3 font-semibold">Perfil</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Criado em</th>
                <th className="px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {user.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.email ?? "-"}
                    </td>
                    <td className="px-4 py-3">{roleLabels[user.role]}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          user.active
                            ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"
                        }
                      >
                        {user.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/configuracoes/usuarios?edit=${user.id}`}
                          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                        >
                          Editar
                        </Link>
                        <form action={toggleUserActive}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            type="hidden"
                            name="nextActive"
                            value={String(!user.active)}
                          />
                          <button
                            type="submit"
                            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                          >
                            {user.active ? "Desativar" : "Ativar"}
                          </button>
                        </form>
                        <Link
                          href={`/configuracoes/usuarios?reset=${user.id}`}
                          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                        >
                          Redefinir senha
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CreateUserForm() {
  return (
    <section className="rounded-md border border-border bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Novo usuário</h2>
          <p className="text-sm text-muted-foreground">
            O usuário será criado no Supabase Auth e vinculado ao profile do portal.
          </p>
        </div>
        <Link
          href="/configuracoes/usuarios"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Fechar
        </Link>
      </div>

      <form action={createUser} className="grid gap-3 md:grid-cols-2">
        <TextField name="name" label="Nome" required />
        <TextField name="email" label="E-mail" type="email" required />
        <TextField
          name="password"
          label="Senha temporária"
          type="password"
          minLength={6}
          required
        />
        <RoleField />
        <ActiveField defaultChecked />
        <FormActions submitLabel="Salvar usuário" />
      </form>
    </section>
  );
}

function EditUserForm({ user }: { user: PortalUser }) {
  return (
    <section className="rounded-md border border-border bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Editar usuário</h2>
          <p className="text-sm text-muted-foreground">
            O e-mail não é editado nesta etapa para manter consistência com o Auth.
          </p>
        </div>
        <Link
          href="/configuracoes/usuarios"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Fechar
        </Link>
      </div>

      <form action={updateUserProfile} className="grid gap-3 md:grid-cols-2">
        <input type="hidden" name="userId" value={user.id} />
        <TextField name="name" label="Nome" defaultValue={user.name ?? ""} required />
        <label className="block">
          <span className="text-sm font-medium text-foreground">E-mail</span>
          <input
            value={user.email ?? ""}
            disabled
            className="mt-1 h-10 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground"
          />
        </label>
        <RoleField defaultValue={user.role} />
        <ActiveField defaultChecked={user.active} />
        <FormActions submitLabel="Salvar alterações" />
      </form>
    </section>
  );
}

function ResetPasswordForm({ user }: { user: PortalUser }) {
  return (
    <section className="rounded-md border border-border bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Redefinir senha</h2>
          <p className="text-sm text-muted-foreground">
            Defina uma nova senha temporária para {user.name ?? user.email}.
          </p>
        </div>
        <Link
          href="/configuracoes/usuarios"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Fechar
        </Link>
      </div>

      <form action={resetUserPassword} className="grid gap-3 md:grid-cols-2">
        <input type="hidden" name="userId" value={user.id} />
        <TextField
          name="password"
          label="Nova senha temporária"
          type="password"
          minLength={6}
          required
        />
        <FormActions submitLabel="Redefinir senha" />
      </form>
    </section>
  );
}

function TextField({
  name,
  label,
  type = "text",
  defaultValue,
  minLength,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  minLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        minLength={minLength}
        required={required}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
      />
    </label>
  );
}

function RoleField({ defaultValue = "equipe" }: { defaultValue?: UserRole }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">Perfil</span>
      <select
        name="role"
        defaultValue={defaultValue}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {roleLabels[role]}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActiveField({ defaultChecked }: { defaultChecked?: boolean }) {
  return (
    <label className="flex h-10 items-center gap-2 self-end text-sm font-medium text-foreground">
      <input
        name="active"
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-border"
      />
      Ativo
    </label>
  );
}

function FormActions({ submitLabel }: { submitLabel: string }) {
  return (
    <div className="flex items-end gap-2 md:col-span-2">
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-white transition hover:opacity-90"
      >
        {submitLabel}
      </button>
      <Link
        href="/configuracoes/usuarios"
        className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        Cancelar
      </Link>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-md border border-border bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </article>
  );
}

function Message({
  type,
  message,
}: {
  type: "success" | "error";
  message?: string;
}) {
  if (!message) {
    return null;
  }

  const className =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${className}`}>
      {message}
    </div>
  );
}

function parseFilters(params?: {
  search?: string;
  role?: string;
  status?: string;
}): UserFilters {
  return {
    search: params?.search?.trim() || undefined,
    role: roles.includes(params?.role as UserRole)
      ? (params?.role as UserRole)
      : undefined,
    status:
      params?.status === "active" || params?.status === "inactive"
        ? params.status
        : undefined,
  };
}

function hasFilters(filters: UserFilters) {
  return Boolean(filters.search || filters.role || filters.status);
}

function getStats(users: PortalUser[]) {
  return {
    total: users.length,
    admins: users.filter((user) => user.role === "admin").length,
    equipe: users.filter((user) => user.role === "equipe").length,
    professores: users.filter((user) => user.role === "professor").length,
    inativos: users.filter((user) => !user.active).length,
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}
