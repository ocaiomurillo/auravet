import { randomUUID } from 'node:crypto';

import type { Module, PrismaClient, Role, RoleModuleAccess, User } from '@prisma/client';

export type InMemoryPrisma = PrismaClient & { reset(): void };

type ModuleRecord = Omit<Module, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date };
type RoleRecord = Omit<Role, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date };
type RoleModuleRecord = RoleModuleAccess;
type UserRecord = Omit<User, 'lastLoginAt'> & { lastLoginAt: Date | null };

type UserInclude = {
  include?: {
    role?: {
      include?: {
        modules?: {
          include?: {
            module?: boolean;
          };
        };
      };
    };
  };
};

type CreateArgs = {
  data: {
    nome: string;
    email: string;
    passwordHash: string;
    roleId: string;
    isActive?: boolean;
  };
} & UserInclude;

type UpdateArgs = {
  where: { id: string };
  data: Partial<Pick<UserRecord, 'nome' | 'email' | 'roleId' | 'isActive' | 'passwordHash' | 'lastLoginAt'>>;
} & UserInclude;

type FindUniqueArgs = { where: { id?: string; email?: string } } & UserInclude;

type FindManyArgs = {
  orderBy?: { createdAt: 'asc' | 'desc' };
} & UserInclude;

type RoleFindArgs = {
  where?: { id?: string; slug?: string };
  include?: {
    modules?: {
      include?: {
        module?: boolean;
      };
    };
  };
};

type RoleCreateArgs = {
  data: {
    id?: string;
    name: string;
    slug: string;
    description?: string | null;
    isActive?: boolean;
    modules?: {
      create?: Array<{
        module: { connect: { id: string } };
        isEnabled?: boolean;
      }>;
    };
  };
  include?: RoleFindArgs['include'];
};

type RoleUpdateArgs = {
  where: { id: string };
  data: Partial<Pick<RoleRecord, 'name' | 'description' | 'isActive'>>;
  include?: RoleFindArgs['include'];
};

type DeleteManyArgs = { where: { roleId?: string } };

type UpsertArgs = {
  where: { roleId_moduleId: { roleId: string; moduleId: string } };
  create: { roleId: string; moduleId: string; isEnabled?: boolean };
  update: { isEnabled?: boolean };
};

const clone = <T>(value: T): T => structuredClone(value);

const buildBaseModules = (): ModuleRecord[] => {
  const now = new Date();
  return [
    {
      id: 'owners:read',
      slug: 'owners:read',
      name: 'Visualizar tutores',
      description: 'Permite visualizar a lista de tutores cadastrados.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'owners:write',
      slug: 'owners:write',
      name: 'Gerenciar tutores',
      description: 'Permite criar e editar tutores.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'animals:read',
      slug: 'animals:read',
      name: 'Visualizar animais',
      description: 'Permite visualizar animais cadastrados.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'animals:write',
      slug: 'animals:write',
      name: 'Gerenciar animais',
      description: 'Permite cadastrar e editar animais.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'services:read',
      slug: 'services:read',
      name: 'Visualizar serviços',
      description: 'Permite visualizar os serviços prestados.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'services:write',
      slug: 'services:write',
      name: 'Gerenciar serviços',
      description: 'Permite registrar e atualizar serviços.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'users:manage',
      slug: 'users:manage',
      name: 'Administrar usuários',
      description: 'Permite criar e gerenciar usuários e funções.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

const buildBaseRoles = (): RoleRecord[] => {
  const now = new Date();
  return [
    {
      id: 'ADMINISTRADOR',
      slug: 'ADMINISTRADOR',
      name: 'Administrador',
      description: 'Acesso completo ao ecossistema Auravet.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'AUXILIAR_ADMINISTRATIVO',
      slug: 'AUXILIAR_ADMINISTRATIVO',
      name: 'Auxiliar Administrativo',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ASSISTENTE_ADMINISTRATIVO',
      slug: 'ASSISTENTE_ADMINISTRATIVO',
      name: 'Assistente Administrativo',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ENFERMEIRO',
      slug: 'ENFERMEIRO',
      name: 'Enfermeiro',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'MEDICO',
      slug: 'MEDICO',
      name: 'Médico',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'CONTADOR',
      slug: 'CONTADOR',
      name: 'Contador',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

const buildBaseRoleModules = (): RoleModuleRecord[] => [
  { roleId: 'ADMINISTRADOR', moduleId: 'owners:read', isEnabled: true },
  { roleId: 'ADMINISTRADOR', moduleId: 'owners:write', isEnabled: true },
  { roleId: 'ADMINISTRADOR', moduleId: 'animals:read', isEnabled: true },
  { roleId: 'ADMINISTRADOR', moduleId: 'animals:write', isEnabled: true },
  { roleId: 'ADMINISTRADOR', moduleId: 'services:read', isEnabled: true },
  { roleId: 'ADMINISTRADOR', moduleId: 'services:write', isEnabled: true },
  { roleId: 'ADMINISTRADOR', moduleId: 'users:manage', isEnabled: true },
  { roleId: 'AUXILIAR_ADMINISTRATIVO', moduleId: 'owners:read', isEnabled: true },
  { roleId: 'AUXILIAR_ADMINISTRATIVO', moduleId: 'owners:write', isEnabled: true },
  { roleId: 'AUXILIAR_ADMINISTRATIVO', moduleId: 'animals:read', isEnabled: true },
  { roleId: 'AUXILIAR_ADMINISTRATIVO', moduleId: 'animals:write', isEnabled: true },
  { roleId: 'AUXILIAR_ADMINISTRATIVO', moduleId: 'services:read', isEnabled: true },
  { roleId: 'ASSISTENTE_ADMINISTRATIVO', moduleId: 'owners:read', isEnabled: true },
  { roleId: 'ASSISTENTE_ADMINISTRATIVO', moduleId: 'animals:read', isEnabled: true },
  { roleId: 'ASSISTENTE_ADMINISTRATIVO', moduleId: 'services:read', isEnabled: true },
  { roleId: 'ENFERMEIRO', moduleId: 'owners:read', isEnabled: true },
  { roleId: 'ENFERMEIRO', moduleId: 'animals:read', isEnabled: true },
  { roleId: 'ENFERMEIRO', moduleId: 'animals:write', isEnabled: true },
  { roleId: 'ENFERMEIRO', moduleId: 'services:read', isEnabled: true },
  { roleId: 'ENFERMEIRO', moduleId: 'services:write', isEnabled: true },
  { roleId: 'MEDICO', moduleId: 'owners:read', isEnabled: true },
  { roleId: 'MEDICO', moduleId: 'animals:read', isEnabled: true },
  { roleId: 'MEDICO', moduleId: 'services:read', isEnabled: true },
  { roleId: 'MEDICO', moduleId: 'services:write', isEnabled: true },
  { roleId: 'CONTADOR', moduleId: 'services:read', isEnabled: true },
];

const attachRole = (user: UserRecord, include?: UserInclude['include']) => {
  const userClone: any = clone(user);

  if (!include?.role) {
    return userClone;
  }

  const roleRecord = roles.find((role) => role.id === user.roleId) ?? null;

  if (!roleRecord) {
    userClone.role = null;
    return userClone;
  }

  const roleClone: any = clone(roleRecord);

  if (include.role.include?.modules) {
    const mappings = roleModules
      .filter((mapping) => mapping.roleId === roleRecord.id)
      .map((mapping) => ({
        roleId: mapping.roleId,
        moduleId: mapping.moduleId,
        isEnabled: mapping.isEnabled,
        module: clone(modules.find((module) => module.id === mapping.moduleId)!),
      }));
    roleClone.modules = mappings;
  }

  userClone.role = roleClone;
  return userClone;
};

const applyRoleInclude = (role: RoleRecord, include?: RoleFindArgs['include']) => {
  const roleClone: any = clone(role);

  if (include?.modules) {
    roleClone.modules = roleModules
      .filter((mapping) => mapping.roleId === role.id)
      .map((mapping) => ({
        roleId: mapping.roleId,
        moduleId: mapping.moduleId,
        isEnabled: mapping.isEnabled,
        module: clone(modules.find((module) => module.id === mapping.moduleId)!),
      }));
  }

  return roleClone;
};

let modules: ModuleRecord[] = [];
let roles: RoleRecord[] = [];
let roleModules: RoleModuleRecord[] = [];
let users: UserRecord[] = [];

const resetState = () => {
  modules = buildBaseModules();
  roles = buildBaseRoles();
  roleModules = buildBaseRoleModules();
  users = [];
};

resetState();

export const createInMemoryPrisma = (): InMemoryPrisma => {
  const findUserById = (id: string) => users.find((user) => user.id === id) ?? null;
  const findUserByEmail = (email: string) => users.find((user) => user.email === email) ?? null;

  const userClient = {
    async findUnique({ where, include }: FindUniqueArgs): Promise<any | null> {
      const record = where.id ? findUserById(where.id) : where.email ? findUserByEmail(where.email) : null;
      return record ? attachRole(record, include) : null;
    },
    async findMany({ orderBy, include }: FindManyArgs = {}): Promise<any[]> {
      const sorted = [...users].sort((a, b) => {
        if (!orderBy || orderBy.createdAt === 'desc') {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      return sorted.map((user) => attachRole(user, include));
    },
    async create({ data, include }: CreateArgs): Promise<any> {
      if (findUserByEmail(data.email)) {
        const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' as const });
        throw error;
      }

      const now = new Date();
      const record: UserRecord = {
        id: randomUUID(),
        nome: data.nome,
        email: data.email,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
      };

      users.push(record);
      return attachRole(record, include);
    },
    async update({ where, data, include }: UpdateArgs): Promise<any> {
      const existing = findUserById(where.id);
      if (!existing) {
        const error = Object.assign(new Error('Record not found'), { code: 'P2025' as const });
        throw error;
      }

      const updated: UserRecord = {
        ...existing,
        ...data,
        roleId: data.roleId ?? existing.roleId,
        lastLoginAt: data.lastLoginAt ?? existing.lastLoginAt,
        updatedAt: new Date(),
      };

      users = users.map((user) => (user.id === existing.id ? updated : user));
      return attachRole(updated, include);
    },
    async deleteMany(): Promise<{ count: number }> {
      const count = users.length;
      users = [];
      return { count };
    },
  } as unknown as PrismaClient['user'];

  const moduleClient = {
    async findMany(): Promise<ModuleRecord[]> {
      return clone(modules);
    },
  } as unknown as PrismaClient['module'];

  const roleClient = {
    async findMany({ include, where }: RoleFindArgs = {}): Promise<any[]> {
      let result = [...roles];
      if (where?.slug) {
        result = result.filter((role) => role.slug === where.slug);
      }
      if (where?.id) {
        result = result.filter((role) => role.id === where.id);
      }
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return result.map((role) => applyRoleInclude(role, include));
    },
    async findUnique({ where, include }: RoleFindArgs): Promise<any | null> {
      if (!where) return null;
      const record = where.id
        ? roles.find((role) => role.id === where.id)
        : where.slug
        ? roles.find((role) => role.slug === where.slug)
        : null;
      return record ? applyRoleInclude(record, include) : null;
    },
    async create({ data, include }: RoleCreateArgs): Promise<any> {
      if (roles.some((role) => role.slug === data.slug)) {
        const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' as const });
        throw error;
      }
      const now = new Date();
      const record: RoleRecord = {
        id: data.id ?? data.slug,
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
      roles.push(record);

      if (data.modules?.create) {
        for (const mapping of data.modules.create) {
          roleModules.push({
            roleId: record.id,
            moduleId: mapping.module.connect.id,
            isEnabled: mapping.isEnabled ?? true,
          });
        }
      }

      return applyRoleInclude(record, include);
    },
    async update({ where, data, include }: RoleUpdateArgs): Promise<any> {
      const existing = roles.find((role) => role.id === where.id);
      if (!existing) {
        const error = Object.assign(new Error('Record not found'), { code: 'P2025' as const });
        throw error;
      }

      const updated: RoleRecord = {
        ...existing,
        ...data,
        description: data.description ?? existing.description,
        updatedAt: new Date(),
      };

      roles = roles.map((role) => (role.id === existing.id ? updated : role));
      return applyRoleInclude(updated, include);
    },
    async delete({ where }: { where: { id: string } }): Promise<RoleRecord> {
      const existing = roles.find((role) => role.id === where.id);
      if (!existing) {
        const error = Object.assign(new Error('Record not found'), { code: 'P2025' as const });
        throw error;
      }

      if (users.some((user) => user.roleId === existing.id)) {
        const error = Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' as const });
        throw error;
      }

      roles = roles.filter((role) => role.id !== existing.id);
      roleModules = roleModules.filter((mapping) => mapping.roleId !== existing.id);
      return clone(existing);
    },
  } as unknown as PrismaClient['role'];

  const roleModuleAccessClient = {
    async upsert({ where, create, update }: UpsertArgs): Promise<RoleModuleRecord> {
      const existingIndex = roleModules.findIndex(
        (mapping) => mapping.roleId === where.roleId_moduleId.roleId && mapping.moduleId === where.roleId_moduleId.moduleId,
      );

      if (existingIndex >= 0) {
        const updated: RoleModuleRecord = {
          ...roleModules[existingIndex],
          isEnabled: update.isEnabled ?? roleModules[existingIndex].isEnabled,
        };
        roleModules[existingIndex] = updated;
        return clone(updated);
      }

      const record: RoleModuleRecord = {
        roleId: create.roleId,
        moduleId: create.moduleId,
        isEnabled: create.isEnabled ?? true,
      };
      roleModules.push(record);
      return clone(record);
    },
    async deleteMany({ where }: DeleteManyArgs): Promise<{ count: number }> {
      if (!where.roleId) {
        return { count: 0 };
      }
      const before = roleModules.length;
      roleModules = roleModules.filter((mapping) => mapping.roleId !== where.roleId);
      return { count: before - roleModules.length };
    },
  } as unknown as PrismaClient['roleModuleAccess'];

  const prisma = {
    user: userClient,
    module: moduleClient,
    role: roleClient,
    roleModuleAccess: roleModuleAccessClient,
    owner: {} as PrismaClient['owner'],
    animal: {} as PrismaClient['animal'],
    servico: {} as PrismaClient['servico'],
    async $transaction<T>(operations: Promise<T>[]): Promise<T[]> {
      const results: T[] = [];
      for (const operation of operations) {
        results.push(await operation);
      }
      return results;
    },
    reset() {
      resetState();
    },
  } as unknown as InMemoryPrisma;

  return prisma;
};
