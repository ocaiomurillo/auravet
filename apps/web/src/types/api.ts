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
}
