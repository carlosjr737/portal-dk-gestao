import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ChamadaDigital } from "@/features/attendance/chamada-digital";
import { getChamadaDaTurma } from "@/features/attendance/presenca-queries";
import { normalizarMes } from "@/features/attendance/presenca-datas";

type RegistrarChamadaPageProps = {
  params: Promise<{ classId: string }>;
  // `month` e não `mes`: é o parâmetro que a listagem de chamada já usa, e
  // trocar o nome quebraria o link de quem tiver a página salva.
  searchParams?: Promise<{ month?: string }>;
};

export default async function RegistrarChamadaPage({
  params,
  searchParams,
}: RegistrarChamadaPageProps) {
  const { classId } = await params;
  const query = await searchParams;
  const mes = normalizarMes(query?.month);

  const chamada = await getChamadaDaTurma(classId, mes);

  if (!chamada) {
    notFound();
  }

  const rotuloDoMes = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1));

  return (
    <div>
      <PageHeader
        title={chamada.turmaNome}
        description={`Chamada de ${rotuloDoMes} · ${chamada.professorNome}`}
        actions={
          <>
            <Link
              href="/chamada"
              className={buttonVariants({ variant: "outline" })}
            >
              Voltar
            </Link>
            <Link
              href={`/chamada/${classId}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Versão para imprimir
            </Link>
          </>
        }
      />

      <ChamadaDigital chamada={chamada} />
    </div>
  );
}
