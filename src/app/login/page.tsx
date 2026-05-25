import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { getAuthenticatedUser } from "@/features/auth/session";

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
      <section className="w-full max-w-md rounded-md border border-border bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          DK Studio
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Portal DK Gestão
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Entre com seu e-mail e senha para acessar o sistema.
        </p>

        <LoginForm message={message} />
      </section>
    </main>
  );
}
