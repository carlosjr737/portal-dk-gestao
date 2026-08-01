import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { getAuthenticatedUser } from "@/features/auth/session";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAME } from "@/lib/branding";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const message =
    params?.message === "inactive"
      ? "Seu acesso está desativado. Procure a administração."
      : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">
          {PLATFORM_NAME}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Entre com seu e-mail e senha para acessar o sistema.
        </p>

        <LoginForm message={message} />
      </Card>
    </main>
  );
}
