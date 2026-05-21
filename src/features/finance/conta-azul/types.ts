import "server-only";

export type ContaAzulPaginatedResponse<T> = {
  itens_totais?: number;
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
