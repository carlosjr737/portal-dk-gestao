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
