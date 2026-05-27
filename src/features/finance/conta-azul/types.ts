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
  competenceDate: string;
  dueDate: string;
  financialAccountId: string;
  revenueCategoryId: string;
};

export type ContaAzulCreateReceivablePayload = {
  id_cliente: string;
  valor: number;
  descricao: string;
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
      conta_financeira: string;
      detalhe_valor: {
        valor_bruto: number;
      };
    }>;
  };
};

export type ContaAzulCreateReceivableResponse = {
  id: string;
  status?: string;
  descricao?: string;
  valor?: number;
  data_competencia?: string;
  id_cliente?: string;
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

export type ContaAzulPeopleResponse = {
  items: ContaAzulPerson[];
  totalItems: number;
};
