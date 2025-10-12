import type { Animal, Module, Owner, Prisma, Product, Servico } from '@prisma/client';

import type { UserWithRole } from './auth';
import { buildAuthenticatedUser } from './auth';

type ServiceWithOptionalRelations = Servico & {
  animal?: AnimalWithOptionalRelations | null;
};

type AnimalWithOptionalRelations = Animal & {
  owner?: Owner | null;
  services?: ServiceWithOptionalRelations[];
};

type OwnerWithOptionalRelations = Owner & {
  animals?: AnimalWithOptionalRelations[];
};

export type SerializedService = {
  id: string;
  animalId: string;
  tipo: Servico['tipo'];
  data: string;
  preco: number;
  observacoes: string | null;
  createdAt: string;
  animal?: SerializedAnimal;
};

export type SerializedAnimal = {
  id: string;
  nome: string;
  especie: Animal['especie'];
  raca: string | null;
  nascimento: string | null;
  ownerId: string;
  createdAt: string;
  owner?: SerializedOwner;
  services?: SerializedService[];
};

export type SerializedOwner = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  createdAt: string;
  animals?: SerializedAnimal[];
};

export type SerializedModule = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SerializedRoleModule = SerializedModule & {
  isEnabled: boolean;
};

export type RoleWithModules = Prisma.RoleGetPayload<{
  include: {
    modules: {
      include: {
        module: true;
      };
    };
  };
}>;

export type SerializedRole = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  modules: SerializedRoleModule[];
  createdAt: string;
  updatedAt: string;
};

export type SerializedUser = {
  id: string;
  nome: string;
  email: string;
  role: {
    id: string;
    slug: string;
    name: string;
  };
  isActive: boolean;
  lastLoginAt: string | null;
  modules: string[];
  createdAt: string;
  updatedAt: string;
};

export type SerializedProduct = {
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
};

export const serializeService = (
  service: ServiceWithOptionalRelations,
  options?: { includeAnimal?: boolean },
): SerializedService => {
  const serialized: SerializedService = {
    id: service.id,
    animalId: service.animalId,
    tipo: service.tipo,
    data: service.data.toISOString(),
    preco: Number(service.preco),
    observacoes: service.observacoes ?? null,
    createdAt: service.createdAt.toISOString(),
  };

  if (options?.includeAnimal && service.animal) {
    serialized.animal = serializeAnimal(service.animal);
  }

  return serialized;
};

export const serializeAnimal = (animal: AnimalWithOptionalRelations): SerializedAnimal => ({
  id: animal.id,
  nome: animal.nome,
  especie: animal.especie,
  raca: animal.raca ?? null,
  nascimento: animal.nascimento ? animal.nascimento.toISOString() : null,
  ownerId: animal.ownerId,
  createdAt: animal.createdAt.toISOString(),
  owner: animal.owner
    ? {
        id: animal.owner.id,
        nome: animal.owner.nome,
        email: animal.owner.email,
        telefone: animal.owner.telefone ?? null,
        createdAt: animal.owner.createdAt.toISOString(),
      }
    : undefined,
  services: animal.services?.map((service) => serializeService(service)),
});

export const serializeOwner = (owner: OwnerWithOptionalRelations): SerializedOwner => ({
  id: owner.id,
  nome: owner.nome,
  email: owner.email,
  telefone: owner.telefone ?? null,
  createdAt: owner.createdAt.toISOString(),
  animals: owner.animals?.map((animal) =>
    serializeAnimal({
      ...animal,
      owner: undefined,
      services: animal.services?.map((service) => ({ ...service, animal: undefined })),
    }),
  ),
});

export const serializeModule = (module: Module): SerializedModule => ({
  id: module.id,
  slug: module.slug,
  name: module.name,
  description: module.description ?? null,
  isActive: module.isActive,
  createdAt: module.createdAt.toISOString(),
  updatedAt: module.updatedAt.toISOString(),
});

export const serializeRole = (role: RoleWithModules): SerializedRole => ({
  id: role.id,
  name: role.name,
  slug: role.slug,
  description: role.description ?? null,
  isActive: role.isActive,
  modules: role.modules
    .slice()
    .sort((a, b) => a.module.name.localeCompare(b.module.name))
    .map((access) => ({
      ...serializeModule(access.module),
      isEnabled: access.isEnabled,
    })),
  createdAt: role.createdAt.toISOString(),
  updatedAt: role.updatedAt.toISOString(),
});

export const serializeUser = (user: UserWithRole): SerializedUser => {
  const authenticated = buildAuthenticatedUser(user);

  return {
    id: authenticated.id,
    nome: authenticated.nome,
    email: authenticated.email,
    role: authenticated.role,
    isActive: authenticated.isActive,
    lastLoginAt: authenticated.lastLoginAt ? authenticated.lastLoginAt.toISOString() : null,
    modules: authenticated.modules,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
};

export const serializeProduct = (product: Product): SerializedProduct => ({
  id: product.id,
  nome: product.nome,
  descricao: product.descricao ?? null,
  custo: Number(product.custo),
  precoVenda: Number(product.precoVenda),
  estoqueAtual: product.estoqueAtual,
  estoqueMinimo: product.estoqueMinimo,
  isActive: product.isActive,
  isSellable: product.isSellable,
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt.toISOString(),
});
