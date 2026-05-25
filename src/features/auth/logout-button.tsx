"use client";

import { logout } from "@/features/auth/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        Sair
      </button>
    </form>
  );
}
