import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAlunosEmRisco } from "@/features/attendance/presenca-queries";

/**
 * Alunos com faltas seguidas.
 *
 * Fica no topo da chamada porque é lá que alguém da escola passa todo dia. O
 * ponto do alerta é agir ANTES do cancelamento: três faltas seguidas é um
 * telefonema, não uma estatística.
 *
 * Não renderiza nada quando não há ninguém em risco — e também quando a
 * tabela ainda não existe (a consulta devolve lista vazia). Assim a tela não
 * quebra entre subir o código e rodar a migração.
 */
export async function AlertaFaltas() {
  const emRisco = await getAlunosEmRisco(3);

  if (emRisco.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6 border-amber-200 bg-amber-50">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-amber-900">
            {emRisco.length === 1
              ? "1 aluno com faltas seguidas"
              : `${emRisco.length} alunos com faltas seguidas`}
          </h2>
          <Badge tone="warning">3 faltas ou mais</Badge>
        </div>
        <p className="mt-1 text-sm text-amber-800">
          Falta avisada não conta aqui — estes sumiram sem dizer nada.
        </p>

        <ul className="mt-4 divide-y divide-amber-200">
          {emRisco.slice(0, 8).map((aluno) => (
            <li
              key={`${aluno.studentId}-${aluno.turmaId}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div>
                <Link
                  href={`/alunos/${aluno.studentId}`}
                  className="font-medium text-amber-900 hover:underline"
                >
                  {aluno.nome}
                </Link>
                <span className="ml-2 text-sm text-amber-800">
                  {aluno.turmaNome}
                </span>
              </div>
              <div className="text-sm text-amber-800">
                {aluno.faltasSeguidas} faltas · última em{" "}
                {formatarData(aluno.ultimaFalta)}
                {aluno.ultimaPresenca
                  ? ` · veio pela última vez em ${formatarData(aluno.ultimaPresenca)}`
                  : ""}
              </div>
            </li>
          ))}
        </ul>

        {emRisco.length > 8 ? (
          <p className="mt-3 text-sm text-amber-800">
            e mais {emRisco.length - 8}.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
