"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";
import { isUserRole, type UserRole } from "@/features/auth/permissions";

export type PortalUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UserFilters = {
  search?: string;
  role?: UserRole;
  status?: "active" | "inactive";
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

const usersPath = "/configuracoes/usuarios";

export async function listUsers(filters: UserFilters = {}) {
  await requireAdmin();

  const supabase = createAdminClient();
  let query = supabase
    .from("profiles")
    .select("id, name, email, role, active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (filters.search) {
    const term = escapeFilterValue(filters.search.trim());
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  if (filters.role) {
    query = query.eq("role", filters.role);
  }

  if (filters.status === "active") {
    query = query.eq("active", true);
  }

  if (filters.status === "inactive") {
    query = query.eq("active", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Users list error:", error.message);
    return [];
  }

  return ((data ?? []) as ProfileRow[])
    .map(normalizeUser)
    .filter((user): user is PortalUser => Boolean(user));
}

export async function createUser(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(formData.get("role"));
  const active = formData.get("active") === "on";

  if (!name || !email || !password || !role) {
    redirectWithMessage("error", "Preencha nome, e-mail, senha e perfil.");
  }

  const supabase = createAdminClient();
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

  if (authError || !authData.user) {
    redirectWithMessage("error", authError?.message ?? "Não foi possível criar o usuário.");
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    name,
    email,
    role,
    active,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    redirectWithMessage("error", profileError.message);
  }

  revalidatePath(usersPath);
  redirectWithMessage("success", "Usuário criado com sucesso.");
}

export async function updateUserProfile(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = parseRole(formData.get("role"));
  const active = formData.get("active") === "on";

  if (!userId || !name || !role) {
    redirectWithMessage("error", "Preencha nome e perfil.");
  }

  const currentUser = await getAuthenticatedUser();

  if (currentUser?.id === userId && !active) {
    redirectWithMessage("error", "Você não pode desativar o próprio usuário.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      name,
      role,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath(usersPath);
  redirectWithMessage("success", "Usuário atualizado com sucesso.");
}

export async function toggleUserActive(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const nextActive = formData.get("nextActive") === "true";

  if (!userId) {
    redirectWithMessage("error", "Usuário inválido.");
  }

  if (admin.id === userId && !nextActive) {
    redirectWithMessage("error", "Você não pode desativar o próprio usuário.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      active: nextActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath(usersPath);
  redirectWithMessage(
    "success",
    nextActive ? "Usuário ativado com sucesso." : "Usuário desativado com sucesso.",
  );
}

export async function resetUserPassword(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!userId || password.length < 6) {
    redirectWithMessage("error", "Informe uma senha temporária com pelo menos 6 caracteres.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath(usersPath);
  redirectWithMessage("success", "Senha redefinida com sucesso.");
}

async function requireAdmin() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileByUserId(user.id);

  if (!profile?.active || profile.role !== "admin") {
    redirect("/acesso-nao-autorizado");
  }

  return profile;
}

function normalizeUser(row: ProfileRow) {
  if (!isUserRole(row.role)) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies PortalUser;
}

function parseRole(value: FormDataEntryValue | null) {
  const role = typeof value === "string" ? value : null;
  return isUserRole(role) ? role : null;
}

function redirectWithMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({
    [type]: message,
  });

  redirect(`${usersPath}?${params.toString()}`);
}

function escapeFilterValue(value: string) {
  return value.replace(/[%_,]/g, "");
}
