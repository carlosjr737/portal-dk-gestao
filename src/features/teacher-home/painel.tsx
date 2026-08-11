import Link from "next/link";
import { CalendarCheck, Clock, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { PainelProfessor } from "@/features/teacher-home/queries";

/**
 * O painel de quem dá aula.
 *
 * Mesma rota do painel da escola, conteúdo outro. Rota separada
 * ("/meu-painel") pareceria mais organizada e cobraria um preço bobo: dois
 * itens de menu chamados "Dashboard", dois endereços para explicar, e a
 * escola tendo que lembrar de liberar o certo para o papel certo.
 */
export function PainelDoProfessor({ dados }: { dados: PainelProfessor }) {
  if (!dados.vinculado) {
    return (
      <div>
        <PageHeader title="Meu painel" description="Suas turmas e seus alunos." />
        <Alert tone="warning" className="mt-6">
          <p className="font-medium">Sua conta ainda não está ligada a um cadastro de professor.</p>
          <p className="mt-1">
            O sistema liga as duas coisas pelo e-mail. Peça para a secretaria
            conferir se o e-mail do seu cadastro de professor é o mesmo com que
            você entrou aqui.
          </p>
        </Alert>
      </div>
    );
  }

  const ocupacaoTotal = dados.turmas.reduce(
    (acc, t) => ({ alunos: acc.alunos + t.alunos, vagas: acc.vagas + t.capacidade }),
    { alunos: 0, vagas: 0 },
  );

  return (
    <div>
      <PageHeader
        title={dados.nome ? `Olá, ${dados.nome}` : "Meu painel"}
        description="Suas turmas, seus alunos e como sua semana está montada."
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          icone={CalendarCheck}
          rotulo="Turmas"
          valor={String(dados.turmas.length)}
          nota={dados.turmas.length === 1 ? "turma ativa" : "turmas ativas"}
        />
        <Indicador
          icone={Users}
          rotulo="Alunos"
          valor={String(dados.totalAlunos)}
          /* Quem faz duas turmas suas conta uma vez — senão o número infla. */
          nota="pessoas distintas"
        />
        <Indicador
          icone={Clock}
          rotulo="Horas por semana"
          valor={dados.horasSemanais.toLocaleString("pt-BR")}
          nota="somando os horários das turmas"
        />
        <Indicador
          icone={Sparkles}
          rotulo="DNA"
          valor={dados.dna ? dados.dna.media.toLocaleString("pt-BR") : "—"}
          nota={
            dados.dna
              ? `${dados.dna.avaliacoes} ${dados.dna.avaliacoes === 1 ? "aula avaliada" : "aulas avaliadas"}`
              : "nenhuma aula avaliada ainda"
          }
        />
      </section>

      {/* Uma nota vinda de uma aula só não é média. Dizer isso evita que o
          número seja lido como veredito sobre o trabalho de alguém. */}
      {dados.dna && dados.dna.avaliacoes < 3 ? (
        <Alert tone="info" className="mt-4">
          Seu DNA vem de {dados.dna.avaliacoes === 1 ? "uma aula avaliada" : `${dados.dna.avaliacoes} aulas avaliadas`}.
          É pouco para virar média — trate como primeira impressão, não como nota.
        </Alert>
      ) : null}

      <section className="mt-8 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Minhas turmas</h2>
          {ocupacaoTotal.vagas > 0 ? (
            <span className="text-sm text-muted-foreground">
              {ocupacaoTotal.alunos} de {ocupacaoTotal.vagas} vagas ocupadas
            </span>
          ) : null}
        </div>

        {dados.turmas.length === 0 ? (
          <Alert tone="info">
            Você ainda não tem turma ativa vinculada ao seu cadastro.
          </Alert>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-white">
            {dados.turmas.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{t.nome}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[t.modalidade, t.nivel].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {t.horarios.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.horarios.join("  ·  ")}
                    </p>
                  ) : null}
                </div>

                <Badge tone={t.capacidade > 0 && t.alunos >= t.capacidade ? "warning" : "neutral"}>
                  {t.alunos}
                  {t.capacidade > 0 ? `/${t.capacidade}` : ""} alunos
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/chamada" className={buttonVariants()}>
          Fazer a chamada
        </Link>
        <Link href="/calendario" className={buttonVariants({ variant: "outline" })}>
          Ver o calendário
        </Link>
      </div>
    </div>
  );
}

function Indicador({
  icone: Icone,
  rotulo,
  valor,
  nota,
}: {
  icone: typeof Users;
  rotulo: string;
  valor: string;
  nota: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icone className="h-4 w-4" />
        <span className="text-sm">{rotulo}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
    </Card>
  );
}
