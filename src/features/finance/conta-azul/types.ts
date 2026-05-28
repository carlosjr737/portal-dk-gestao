import "server-only";

export type ContaAzulPaginatedResponse<T> = {
  itens_totais?: number;
  total_itens?: number;
  totalItems?: number;
  items?: T[];
  itens?: T[];
};

export type ContaAzulReceivableSearchResponse = {
  itens: ContaAzulReceivable[];
  itens_totais: number;
};

export type ContaAzulReceivable = {
  id: string;
  descricao?: string;
  data_vencimento: string;
  status: string;
  status_traduzido?: string;
  total: number;
  nao_pago: number;
  pago?: number;
  data_competencia?: string;
  cliente?: {
    id?: string;
    nome?: string;
  };
};

export type ContaAzulCreateReceivableInput = {
  customerId: string;
  amount: number;
  description: string;
  observation: string;
  competenceDate: string;
  dueDate: string;
  financialAccountId: string;
  revenueCategoryId: string;
};

export type ContaAzulCreateContractInput = {
  customerId: string;
  contractNumber: number;
  issueDate: string;
  startDate: string;
  endDate: string | null;
  firstDueDate: string;
  dueDay: number;
  description?: string;
  observations: string;
  amount?: number;
  financialAccountId: string;
  revenueCategoryId: string;
  itemId?: string;
  items?: Array<{
    itemId: string;
    description: string;
    amount: number;
  }>;
};

export type ContaAzulCreateContractPayload = {
  id_cliente: string;
  data_emissao: string;
  id_categoria: string;
  observacoes: string;
  observacoes_pagamento: string;
  termos: {
    tipo_frequencia: "MENSAL";
    tipo_expiracao: "DATA" | "NUNCA";
    data_inicio: string;
    data_fim?: string;
    intervalo_frequencia: number;
    dia_emissao_venda: number;
    numero: number;
  };
  condicao_pagamento: {
    tipo_pagamento: "BOLETO_BANCARIO";
    id_conta_financeira: string;
    dia_vencimento: number;
    primeira_data_vencimento: string;
  };
  itens: Array<{
    id: string;
    quantidade: number;
    descricao: string;
    valor: number;
  }>;
};

export type ContaAzulCreateContractResponse = {
  id?: string;
  id_legado?: number;
  id_venda?: string;
  [key: string]: unknown;
};

export type ContaAzulCloseContractResponse = {
  status: number;
  body: unknown;
};

export type ContaAzulService = {
  id: string;
  descricao: string;
  preco: number | null;
  status: string;
};

export type ContaAzulCreateServiceInput = {
  descricao: string;
  preco: number;
};

export type ContaAzulCreateServicePayload = {
  descricao: string;
  preco: number;
  custo: 0;
  status: "ATIVO";
  tipo_servico: "PRESTADO";
};

export type ContaAzulCreateServiceResponse = {
  id?: string;
  descricao?: string;
  preco?: number;
  status?: string;
  [key: string]: unknown;
};

export type ContaAzulCreateReceivablePayload = {
  contato: string;
  valor: number;
  descricao: string;
  observacao: string;
  data_competencia: string;
  conta_financeira: string;
  rateio: Array<{
    id_categoria: string;
    valor: number;
  }>;
  condicao_pagamento: {
    parcelas: Array<{
      descricao: string;
      data_vencimento: string;
      nota: string;
      conta_financeira: string;
      detalhe_valor: {
        valor_bruto: number;
        valor_liquido: number;
      };
    }>;
  };
};

export type ContaAzulCreateReceivableResponse = {
  protocolId?: string;
  protocol_id?: string;
  protocolo?: string;
  id?: string;
  status?: string;
  createdAt?: string;
  data_criacao?: string;
  data?: {
    protocolId?: unknown;
    protocolo?: unknown;
    id?: unknown;
  };
  result?: {
    protocolId?: unknown;
    protocolo?: unknown;
    id?: unknown;
  };
  [key: string]: unknown;
};

export type ContaAzulFinancialAccount = {
  id: string;
  nome: string;
  ativo: boolean;
  tipo: string;
};

export type ContaAzulRevenueCategory = {
  id: string;
  nome: string;
  tipo: string;
};

export type ContaAzulEndpointDiagnostic = {
  label: string;
  endpoint: string;
  status: number | null;
  ok: boolean;
  message: string;
  itemCount: number;
  used: boolean;
  fallback: boolean;
};

export type ContaAzulPerson = {
  id: string;
  nome: string;
  documento?: string;
  email?: string;
  tipo_pessoa?: string;
  ativo?: boolean;
  perfis?: string[];
  atrasos_recebimentos?: number;
  recebimentos_mes_atual?: number;
  endereco?: {
    logradouro?: string;
    numero?: string;
    cidade?: string;
    estado?: string;
  };
};

export type ContaAzulCreatePersonInput = {
  nome: string;
  cpf: string;
  email?: string | null;
  telefone_celular?: string | null;
};

export type ContaAzulCreatePersonPayload = {
  nome: string;
  tipo_pessoa: "Física";
  cpf: string;
  email?: string;
  telefone_celular?: string;
  perfis: Array<{
    tipo_perfil: "Cliente";
  }>;
};

export type ContaAzulPeopleResponse = {
  items: ContaAzulPerson[];
  totalItems: number;
};
