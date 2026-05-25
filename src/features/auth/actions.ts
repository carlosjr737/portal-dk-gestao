"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileByUserId } from "@/features/auth/session";

export type LoginActionState = {
  message?: string;
};

export async function login(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      message: "Informe e-mail e senha.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      message: "E-mail ou senha inválidos.",
    };
  }

  const profile = await getProfileByUserId(data.user.id);

  if (!profile?.active) {
    await supabase.auth.signOut();

    return {
      message: "Seu acesso está desativado. Procure a administração.",
    };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
