import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { canAccessPath } from "@/features/auth/permissions";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileByUserId(user.id);

  if (!profile?.active) {
    redirect("/auth/logout?reason=inactive");
  }

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/dashboard";

  if (!canAccessPath(profile.role, pathname)) {
    redirect("/acesso-nao-autorizado");
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
