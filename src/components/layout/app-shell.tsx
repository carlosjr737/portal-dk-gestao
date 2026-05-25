"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { LogoutButton } from "@/features/auth/logout-button";
import { roleLabels, type UserProfile } from "@/features/auth/permissions";

type AppShellProps = {
  children: React.ReactNode;
  profile: UserProfile;
};

export function AppShell({ children, profile }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        role={profile.role}
      />

      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-foreground/35 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <div className="min-h-screen md:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground md:hidden"
                onClick={() => setIsSidebarOpen(true)}
              >
                Menu
              </button>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Portal DK Gestão
                </p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Sistema interno do DK Studio
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-foreground">
                  {profile.name ?? profile.email ?? "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {roleLabels[profile.role]}
                </p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
