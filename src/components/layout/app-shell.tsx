"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { LogoutButton } from "@/features/auth/logout-button";
import { roleLabels, type UserProfile } from "@/features/auth/permissions";
import { PLATFORM_NAME } from "@/lib/branding";
import { Button } from "@/components/ui/button";

type AppShellProps = {
  children: React.ReactNode;
  profile: UserProfile;
  /** Escola cobra pelo sistema? Esconde as telas que dependem disso. */
  usaModuloFinanceiro?: boolean;
  /** Nome da escola do usuário logado, exibido na barra lateral. */
  escolaNome?: string | null;
};

export function AppShell({
  children,
  profile,
  usaModuloFinanceiro = true,
  escolaNome,
}: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        role={profile.role}
        usaModuloFinanceiro={usaModuloFinanceiro}
        escolaNome={escolaNome}
      />

      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-foreground/45 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <div className="min-h-screen md:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              {/*
                O patch reestilizava um <button> cru aqui, porque foi escrito
                antes da migração para o componente. A regra do próprio
                documento decide: zero botão cru. A variante `outline` já
                entrega border-input e o raio de 8px que ele pedia à mão.
              */}
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden"
              >
                Menu
              </Button>
              {/*
                No desktop a barra lateral já mostra a escola a 20px daqui:
                repetir era gastar a única faixa que poderia orientar. No
                mobile a lateral está fechada, então a linha volta.
              */}
              <p className="text-sm font-semibold text-foreground md:hidden">
                {escolaNome ?? PLATFORM_NAME}
              </p>
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

        <main className="px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
