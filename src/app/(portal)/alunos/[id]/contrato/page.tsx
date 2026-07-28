import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudentContract } from "@/features/contracts/queries";
import { ContractView } from "@/features/contracts/contract-view";
import { AutoPrint } from "@/features/contracts/auto-print";
import { PrintButton } from "@/features/print/print-button";

export const dynamic = "force-dynamic";

type ContratoPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ auto?: string }>;
};

export async function generateMetadata({ params }: ContratoPageProps) {
  const { id } = await params;
  const contract = await getStudentContract(id);
  const nome = contract.guardian?.fullName ?? contract.student.fullName;
  // Vira o nome sugerido do PDF ao "Salvar como PDF".
  return { title: nome ? `${nome} - Contrato` : "Contrato" };
}

export default async function ContratoAlunoPage({
  params,
  searchParams,
}: ContratoPageProps) {
  const { id } = await params;
  const autoPrint = (await searchParams)?.auto === "1";
  const contract = await getStudentContract(id);

  if (!contract.student.fullName) {
    notFound();
  }

  const now = new Date();
  const emitidoEm = {
    dia: now.getDate(),
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
  };

  return (
    <div className="bg-white">
      <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/alunos/${id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Voltar para o aluno
        </Link>
        <PrintButton label="Imprimir / Salvar PDF" />
      </div>

      <ContractView contract={contract} emitidoEm={emitidoEm} />
      {autoPrint ? <AutoPrint /> : null}
    </div>
  );
}
