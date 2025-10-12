export interface Module {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleModule extends Module {
  isEnabled: boolean;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  modules: RoleModule[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleSummary {
  id: string;
  slug: string;
  name: string;
}

export interface Owner {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  createdAt: string;
  animals?: Animal[];
}

export interface Animal {
  id: string;
  nome: string;
  especie: 'CACHORRO' | 'GATO' | 'OUTROS';
  raca?: string | null;
  nascimento?: string | null;
  ownerId: string;
  createdAt: string;
  owner?: Owner;
  services?: Service[];
}

export interface Service {
  id: string;
  animalId: string;
  tipo: 'CONSULTA' | 'EXAME' | 'VACINACAO' | 'CIRURGIA' | 'OUTROS';
  data: string;
  preco: number;
  observacoes?: string | null;
  createdAt: string;
  animal?: Animal;
  items: ServiceItem[];
}

export interface ServiceItem {
  id: string;
  productId: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  product: {
    id: string;
    nome: string;
    precoVenda: number;
    estoqueAtual: number;
    estoqueMinimo: number;
  };
}

export interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  custo: number;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  isActive: boolean;
  isSellable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  nome: string;
  email: string;
  role: UserRoleSummary;
  isActive: boolean;
  lastLoginAt: string | null;
  modules: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthLoginResponse {
  token: string;
  user: User;
}
