import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/**
 * Guia de estilo — todos os componentes numa página só.
 *
 * Existe por dois motivos. O primeiro é ver o sistema inteiro de uma vez:
 * quando cada componente só aparece na sua tela, uma inconsistência entre dois
 * deles nunca fica lado a lado para alguém notar.
 *
 * O segundo é mais prático: sem esta página, qualquer ajuste visual só podia
 * ser conferido entrando no portal, e portanto só por quem tem login e dados
 * reais na frente. Aqui não há dado nenhum — o conteúdo é inventado, mas com a
 * cara do que o portal mostra de verdade, porque componente testado com "Lorem
 * ipsum" esconde justamente os problemas de comprimento de texto.
 *
 * Fora do grupo (portal) de propósito: não exige sessão, e não toca no banco.
 */
export const metadata = {
  title: "Guia de estilo — Portal DK Gestão",
};

export default function EstiloPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-12">
        <PageHeader
          title="Guia de estilo"
          description="Todos os componentes do sistema, com conteúdo parecido com o real. Serve para conferir consistência e para testar mudanças visuais sem precisar entrar no portal."
          actions={
            <>
              <Button variant="outline">Ação secundária</Button>
              <Button>Ação principal</Button>
            </>
          }
        />

        <Secao titulo="Tipografia" nota="A escala e o peso que separam um nível do outro.">
          <Card className="space-y-4 p-5">
            <h1 className="text-2xl font-bold leading-8 tracking-tight text-foreground">
              Título de página — Matrículas
            </h1>
            <h2 className="text-lg font-semibold text-foreground">
              Título de seção — Turmas do aluno
            </h2>
            <h3 className="text-sm font-semibold text-foreground">
              Título de cartão — Contrato consolidado
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Texto de apoio. É o tamanho usado em descrições, ajuda de campo e
              corpo de aviso. A linha tem espaçamento maior que o padrão para
              não cansar em parágrafos de duas ou três linhas.
            </p>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rótulo de dado — responsável financeiro
            </p>
            <p className="text-sm font-medium tabular-nums text-foreground">
              Número em coluna — R$ 1.284,50
            </p>
          </Card>
        </Secao>

        <Secao
          titulo="Botões"
          nota="Uma ação principal por tela. O contorno é para voltar, cancelar, filtrar."
        >
          <Card className="space-y-5 p-5">
            <Linha rotulo="Variantes">
              <Button>Salvar</Button>
              <Button variant="outline">Cancelar</Button>
              <Button variant="secondary">Imprimir</Button>
              <Button variant="destructive">Excluir</Button>
              <Button variant="ghost">Ver detalhes</Button>
              <Button variant="link">Saiba mais</Button>
            </Linha>
            <Linha rotulo="Tamanhos">
              <Button size="lg">Grande</Button>
              <Button>Padrão</Button>
              <Button size="sm">Pequeno</Button>
              <Button size="icon" aria-label="Adicionar">
                +
              </Button>
            </Linha>
            <Linha rotulo="Desabilitado">
              <Button disabled>Salvar</Button>
              <Button variant="outline" disabled>
                Cancelar
              </Button>
              <Button variant="destructive" disabled>
                Excluir
              </Button>
            </Linha>
          </Card>
        </Secao>

        <Secao
          titulo="Campos"
          nota="O rótulo aponta para o campo por id, e o erro é lido junto com ele."
        >
          <Card className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Nome completo" required>
              <Input defaultValue="Ana Beatriz Nogueira" />
            </Field>
            <Field label="CPF" hint="Só números, 11 dígitos.">
              <Input defaultValue="123.456.789-00" />
            </Field>
            <Field label="Turma">
              <Select defaultValue="ballet-inf-2">
                <option value="ballet-inf-2">Ballet Infantil II — Ter/Qui 17h</option>
                <option value="jazz-juv">Jazz Juvenil — Seg/Qua 19h</option>
              </Select>
            </Field>
            <Field label="Valor da mensalidade" error="Informe um valor maior que zero.">
              <Input defaultValue="0,00" />
            </Field>
            <Field label="Data de início" className="md:col-span-1">
              <Input type="date" defaultValue="2026-02-03" />
            </Field>
            <Field label="Campo desabilitado">
              <Input defaultValue="Não editável" disabled />
            </Field>
            <Field label="Observações" className="md:col-span-2">
              <Textarea defaultValue="Aluna com histórico de lesão no joelho direito. Evitar saltos altos no aquecimento." />
            </Field>
          </Card>
        </Secao>

        <Secao titulo="Avisos" nota="Erro e atenção interrompem o leitor de tela; sucesso e informação esperam.">
          <div className="space-y-3">
            <Alert tone="success">
              Chamada salva: 18 de 20 presentes.
            </Alert>
            <Alert tone="warning">
              Matrícula criada sem responsável financeiro. Você poderá vincular depois.
            </Alert>
            <Alert tone="danger">
              Não foi possível gerar a cobrança: o responsável não tem CPF cadastrado.
            </Alert>
            <Alert tone="info">
              Esta escola não usa o módulo de pagamentos, então a tela de inadimplência não aparece no menu.
            </Alert>
          </div>
        </Secao>

        <Secao titulo="Pílulas de status" nota="O tom vem do significado, não da cor escolhida na hora.">
          <Card className="p-5">
            <Linha rotulo="Tons">
              <Badge tone="success">Em dia</Badge>
              <Badge tone="warning">Vence hoje</Badge>
              <Badge tone="danger">Atrasada 12 dias</Badge>
              <Badge tone="info">Aguardando aprovação</Badge>
              <Badge tone="neutral">Arquivada</Badge>
              <Badge tone="brand">Novo</Badge>
            </Linha>
          </Card>
        </Secao>

        <Secao titulo="Tabela" nota="A moldura e a rolagem horizontal vêm do componente.">
          <Table minWidth="640px">
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right tabular-nums">Mensalidade</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-foreground">
                  Ana Beatriz Nogueira
                </TableCell>
                <TableCell className="text-muted-foreground">
                  Ballet Infantil II
                </TableCell>
                <TableCell className="text-muted-foreground">
                  Marcela Nogueira
                </TableCell>
                <TableCell className="text-right tabular-nums">R$ 320,00</TableCell>
                <TableCell>
                  <Badge tone="success">Em dia</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-foreground">
                  Gabriel Santos de Oliveira Junior
                </TableCell>
                <TableCell className="text-muted-foreground">Jazz Juvenil</TableCell>
                <TableCell className="text-muted-foreground">Próprio aluno</TableCell>
                <TableCell className="text-right tabular-nums">R$ 1.284,50</TableCell>
                <TableCell>
                  <Badge tone="danger">Atrasada 12 dias</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-foreground">Lia Marques</TableCell>
                <TableCell className="text-muted-foreground">
                  Contemporâneo Avançado
                </TableCell>
                <TableCell className="text-muted-foreground">Rita Marques</TableCell>
                <TableCell className="text-right tabular-nums">R$ 410,00</TableCell>
                <TableCell>
                  <Badge tone="warning">Vence hoje</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Table minWidth="480px" containerClassName="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty colSpan={3}>
                Nenhum aluno encontrado para os filtros selecionados.
              </TableEmpty>
            </TableBody>
          </Table>
        </Secao>

        <Secao titulo="Cartões" nota="Um padding só; quem precisa de outro pede.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Alunos ativos
              </p>
              <p className="mt-2 text-[28px] leading-[34px] font-bold tabular-nums text-foreground">
                669
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Receita prevista
              </p>
              <p className="mt-2 text-[28px] leading-[34px] font-bold tabular-nums text-foreground">
                R$ 214.080
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Inadimplência
              </p>
              <p className="mt-2 text-[28px] leading-[34px] font-bold tabular-nums text-foreground">
                4,2%
              </p>
            </Card>
          </div>
        </Secao>
      </div>
    </main>
  );
}

function Secao({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{nota}</p>
      </div>
      {children}
    </section>
  );
}

function Linha({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
