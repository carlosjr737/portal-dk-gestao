/**
 * Mensalidades vistas de dentro da ficha do aluno.
 *
 * UMA COISA PRECISA FICAR CLARA ANTES DE LER O RESTO: a cobrança esperada não
 * existe como linha no banco. Quem materializa é o provedor, quando a
 * assinatura gera a parcela; do lado manual, só o RECEBIMENTO vira registro
 * (`recebimento_manual`). Ver o comentário de `features/recebimentos/queries.ts`
 * — materializar 666 cobranças por mês criaria um cemitério de linhas que
 * ninguém preenche.
 *
 * Então esta tela monta as linhas em memória, de duas fontes diferentes:
 *
 * - canal `asaas`: as parcelas vêm do provedor, ao vivo. Ele é a verdade.
 * - canal `manual`: os meses são projetados da matrícula e cruzados com o que
 *   já foi marcado como recebido.
 *
 * A unidade de cobrança também muda entre os dois, e isso não é descuido: no
 * Asaas a assinatura é do RESPONSÁVEL (irmãos dividem uma cobrança só), e no
 * manual a baixa é por MATRÍCULA. Por isso cada linha diz a que se refere.
 */

export type CanalCobranca = "asaas" | "manual";

export type StatusMensalidade =
  | "pago"
  | "pendente"
  | "atrasado"
  | "cancelado"
  | "estornado";

export type LinhaMensalidade = {
  /** Estável dentro da lista, para o React e para o modal saber quem editar. */
  id: string;
  /**
   * Mês de referência no formato do banco: `YYYY-MM-01`. É o mesmo valor que
   * `recebimento_manual.competencia` guarda, então a baixa manual manda esta
   * string sem conversão.
   */
  competencia: string;
  vencimento: string | null;
  /** Data em que o dinheiro entrou. `null` enquanto não entrou. */
  recebimento: string | null;
  valor: number;
  /** O que entrou de fato, quando difere do combinado. */
  valorRecebido: number | null;
  status: StatusMensalidade;
  canal: CanalCobranca;
  /** A que se refere: turma (manual) ou contrato do responsável (Asaas). */
  referencia: string;
  /** Preenchido no canal Asaas — identifica a parcela no provedor. */
  paymentId: string | null;
  billingType: string | null;
  invoiceUrl: string | null;
  /** Preenchido no canal manual — é por matrícula que a baixa é gravada. */
  enrollmentId: string | null;
  /**
   * Linha do Asaas não aceita baixa à mão: quem manda nela é o webhook.
   * Marcar dos dois lados faria a mesma entrada de dinheiro ser contada duas
   * vezes no mês.
   */
  travada: boolean;
};

export type ContratoDoAluno = {
  contratoId: string;
  responsavelId: string;
  responsavelNome: string;
  /** Soma mensal do contrato — pode incluir irmãos. */
  valorTotal: number;
  temAssinatura: boolean;
  statusAssinatura: string | null;
  /** Nomes dos outros alunos cobertos pelo mesmo contrato, se houver. */
  outrosAlunos: string[];
};

export type MensalidadesDoAluno = {
  /** Escola que não optou pelo módulo financeiro não vê a seção. */
  usaPagamentos: boolean;
  linhas: LinhaMensalidade[];
  contratos: ContratoDoAluno[];
  /** Total combinado por mês para ESTE aluno (não inclui irmãos). */
  mensalidadeAtual: number;
  emAberto: number;
  valorEmAberto: number;
  /** Falha na leitura do provedor — a tela avisa em vez de mostrar vazio. */
  avisoProvedor: string | null;
};
