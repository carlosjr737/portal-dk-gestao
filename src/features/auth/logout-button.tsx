"use client";

import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button
        variant="outline"
        size="sm"
        type="submit"
        className="bg-white text-xs text-muted-foreground hover:text-foreground"
      >
        Sair
      </Button>
    </form>
  );
}
