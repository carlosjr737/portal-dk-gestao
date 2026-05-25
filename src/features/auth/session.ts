import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isUserRole,
  type UserProfile,
} from "@/features/auth/permissions";

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  active: boolean | null;
};

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getProfileByUserId(userId: string): Promise<UserProfile | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, active")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("Auth profile load error:", error.message);
    }

    return null;
  }

  return normalizeProfile(data as ProfileRow);
}

function normalizeProfile(profile: ProfileRow): UserProfile | null {
  if (!isUserRole(profile.role)) {
    return null;
  }

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    active: profile.active === true,
  };
}
