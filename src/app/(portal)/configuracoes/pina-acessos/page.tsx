import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";
import { getStaffDisplayName } from "@/features/staff/formatters";
import { PinaAccessManager } from "@/features/pina/pina-access-manager";
import { ConvitePina } from "@/features/pina/convite-pina";
import { listarPessoasPina } from "@/features/pina/pessoas";
import { getCurrentEscolaId } from "@/features/auth/session";

export const dynamic = "force-dynamic";

export default async function PinaAcessosPage() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    notFound();
  }

  const pessoas = await listarPessoasPina(await getCurrentEscolaId());

  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("staff_members")
    .select("id, full_name, artistic_name, email")
    .eq("role", "professor")
    .order("full_name");

  const professores = (staff ?? []).map((s) => ({
    id: s.id as string,
    nome: getStaffDisplayName(s),
    email: (s.email as string | null) ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Acessos ao Pina"
        description="Login direto do professor no Pina (app de formações). Cria a conta Firebase e gera o link de senha."
      />
      <div className="mt-6">
        <PinaAccessManager professores={professores} />
      </div>

      <div className="mt-8">
        <ConvitePina pessoas={pessoas} />
      </div>
    </div>
  );
}
