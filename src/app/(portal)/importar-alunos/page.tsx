import { PageHeader } from "@/components/layout/page-header";
import { StudentImportForm } from "@/features/student-import/student-import-form";

export const dynamic = "force-dynamic";

export default function ImportarAlunosPage() {
  return (
    <div>
      <PageHeader
        title="Importar alunos"
        description="Analise a planilha do DK Studio antes de gravar alunos, responsáveis e matrículas."
      />
      <StudentImportForm />
    </div>
  );
}
