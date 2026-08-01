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
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

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
          className={cn(buttonVariants({ variant: "secondary" }), "font-semibold")}
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

      <form className="grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-4">
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-foreground">Buscar</span>
          <Input
            name="search"
            defaultValue={filters.search}
            placeholder="Nome ou e-mail"
            className="mt-1"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Perfil</span>
          <Select
            name="role"
            defaultValue={filters.role ?? ""}
            className="mt-1"
          >
            <option value="">Todos</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Status</span>
          <Select
            name="status"
            defaultValue={filters.status ?? ""}
            className="mt-1"
          >
            <option value="">Todos</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </Select>
        </label>

        <div className="flex items-end gap-2 md:col-span-4">
          <Button variant="outline"
            className="font-semibold"
            type="submit"
          >
            Filtrar
          </Button>
          <Link
            href="/configuracoes/usuarios"
            className={buttonVariants({ variant: "outline" })}
          >
            Limpar
          </Link>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length > 0 ? (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-foreground">
                  {user.name ?? "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email ?? "-"}
                </TableCell>
                <TableCell>{roleLabels[user.role]}</TableCell>
                <TableCell>
                  <span
                    className={
                      user.active
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"
                    }
                  >
                    {user.active ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell>
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
                      <Button
                        variant="outline"
                        size="sm"
                        type="submit"
                        className="h-8 text-xs"
                      >
                        {user.active ? "Desativar" : "Ativar"}
                      </Button>
                    </form>
                    <Link
                      href={`/configuracoes/usuarios?reset=${user.id}`}
                      className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                    >
                      Redefinir senha
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={6}>Nenhum usuário encontrado.</TableEmpty>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CreateUserForm() {
  return (
    <Card className="p-4">
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
    </Card>
  );
}

function EditUserForm({ user }: { user: PortalUser }) {
  return (
    <Card className="p-4">
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
          <Input
            value={user.email ?? ""}
            disabled
            className="mt-1 bg-muted text-muted-foreground"
          />
        </label>
        <RoleField defaultValue={user.role} />
        <ActiveField defaultChecked={user.active} />
        <FormActions submitLabel="Salvar alterações" />
      </form>
    </Card>
  );
}

function ResetPasswordForm({ user }: { user: PortalUser }) {
  return (
    <Card className="p-4">
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
    </Card>
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
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        minLength={minLength}
        required={required}
        className="mt-1"
      />
    </label>
  );
}

function RoleField({ defaultValue = "equipe" }: { defaultValue?: UserRole }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">Perfil</span>
      <Select
        name="role"
        defaultValue={defaultValue}
        className="mt-1"
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {roleLabels[role]}
          </option>
        ))}
      </Select>
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
      <Button
        variant="secondary"
        className="font-semibold"
        type="submit"
      >
        {submitLabel}
      </Button>
      <Link
        href="/configuracoes/usuarios"
        className={buttonVariants({ variant: "outline" })}
      >
        Cancelar
      </Link>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-[28px] leading-[34px] font-bold tabular-nums text-foreground">{value}</p>
    </Card>
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
