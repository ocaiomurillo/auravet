import { randomUUID } from 'node:crypto';

import * as PrismaModule from '@prisma/client';
import type { Module, PrismaClient, Role, RoleModuleAccess, User } from '@prisma/client';

const { Prisma } = PrismaModule;
const appointmentStatus = {
  AGENDADO: 'AGENDADO',
  CONFIRMADO: 'CONFIRMADO',
  CONCLUIDO: 'CONCLUIDO',
};

(Prisma as unknown as { AppointmentStatus?: Record<string, string> }).AppointmentStatus ??= appointmentStatus;
(PrismaModule as unknown as { AppointmentStatus?: Record<string, string> }).AppointmentStatus ??= appointmentStatus;

export type InMemoryPrisma = PrismaClient & { reset(): void };

const ROLE_IDS = {
  ADMINISTRADOR: 'ckadmin000000000000000001',
  AUXILIAR_ADMINISTRATIVO: 'ckauxadm00000000000000001',
  ASSISTENTE_ADMINISTRATIVO: 'ckassist00000000000000001',
  ENFERMEIRO: 'ckenferm00000000000000001',
  MEDICO: 'ckmedico00000000000000001',
  CONTADOR: 'ckcontab00000000000000001',
} as const;

type ModuleRecord = Omit<Module, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date };
type RoleRecord = Omit<Role, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date };
type RoleModuleRecord = RoleModuleAccess;
type UserRecord = Omit<User, 'lastLoginAt'> & { lastLoginAt: Date | null };
type OwnerRecord = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  createdAt: Date;
};

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

type RoleWhere = { id?: string; slug?: string; OR?: RoleWhere[] };

type RoleFindArgs = {
  where?: RoleWhere;
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

type OwnerWhere = { id?: string; email?: string; cpf?: string };
type OwnerSelect = Partial<Record<keyof OwnerRecord, boolean>>;
type OwnerOrderBy = Partial<Record<'createdAt' | 'nome', 'asc' | 'desc'>>;
type OwnerFindManyArgs = { where?: OwnerWhere; select?: OwnerSelect; orderBy?: OwnerOrderBy };
type OwnerFindUniqueArgs = { where: OwnerWhere; select?: OwnerSelect };
type OwnerCreateArgs = {
  data: {
    id?: string;
    nome: string;
    email: string;
    telefone?: string | null;
    cpf?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
  };
};
type OwnerUpdateArgs = {
  where: { id: string };
  data: Partial<Omit<OwnerCreateArgs['data'], 'id'>>;
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
    {
      id: 'cashier:access',
      slug: 'cashier:access',
      name: 'Caixa',
      description: 'Permite gerenciar contas a receber e registrar pagamentos.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

const projectOwnerRecord = (owner: OwnerRecord, select?: OwnerSelect) => {
  const base = {
    id: owner.id,
    nome: owner.nome,
    email: owner.email,
    telefone: owner.telefone,
    cpf: owner.cpf,
    logradouro: owner.logradouro,
    numero: owner.numero,
    complemento: owner.complemento,
    bairro: owner.bairro,
    cidade: owner.cidade,
    estado: owner.estado,
    cep: owner.cep,
    createdAt: owner.createdAt,
  };

  if (select && Object.keys(select).length > 0) {
    const partial: Record<string, unknown> = {};
    for (const key of Object.keys(select) as Array<keyof typeof base>) {
      if (select[key]) {
        partial[key as string] = base[key];
      }
    }
    return partial as Partial<typeof base>;
  }

  return {
    ...base,
    animals: [],
    appointments: [],
    invoices: [],
  };
};

const buildBaseRoles = (): RoleRecord[] => {
  const now = new Date();
  return [
    {
      id: ROLE_IDS.ADMINISTRADOR,
      slug: 'ADMINISTRADOR',
      name: 'Administrador',
      description: 'Acesso completo ao ecossistema Auravet.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ROLE_IDS.AUXILIAR_ADMINISTRATIVO,
      slug: 'AUXILIAR_ADMINISTRATIVO',
      name: 'Auxiliar Administrativo',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ROLE_IDS.ASSISTENTE_ADMINISTRATIVO,
      slug: 'ASSISTENTE_ADMINISTRATIVO',
      name: 'Assistente Administrativo',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ROLE_IDS.ENFERMEIRO,
      slug: 'ENFERMEIRO',
      name: 'Enfermeiro',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ROLE_IDS.MEDICO,
      slug: 'MEDICO',
      name: 'Médico',
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: ROLE_IDS.CONTADOR,
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
  { roleId: ROLE_IDS.ADMINISTRADOR, moduleId: 'owners:read', isEnabled: true },
  { roleId: ROLE_IDS.ADMINISTRADOR, moduleId: 'owners:write', isEnabled: true },
  { roleId: ROLE_IDS.ADMINISTRADOR, moduleId: 'animals:read', isEnabled: true },
  { roleId: ROLE_IDS.ADMINISTRADOR, moduleId: 'animals:write', isEnabled: true },
  { roleId: ROLE_IDS.ADMINISTRADOR, moduleId: 'services:read', isEnabled: true },
  { roleId: ROLE_IDS.ADMINISTRADOR, moduleId: 'services:write', isEnabled: true },
  { roleId: ROLE_IDS.ADMINISTRADOR, moduleId: 'users:manage', isEnabled: true },
  { roleId: ROLE_IDS.ADMINISTRADOR, moduleId: 'cashier:access', isEnabled: true },
  { roleId: ROLE_IDS.AUXILIAR_ADMINISTRATIVO, moduleId: 'owners:read', isEnabled: true },
  { roleId: ROLE_IDS.AUXILIAR_ADMINISTRATIVO, moduleId: 'owners:write', isEnabled: true },
  { roleId: ROLE_IDS.AUXILIAR_ADMINISTRATIVO, moduleId: 'animals:read', isEnabled: true },
  { roleId: ROLE_IDS.AUXILIAR_ADMINISTRATIVO, moduleId: 'animals:write', isEnabled: true },
  { roleId: ROLE_IDS.AUXILIAR_ADMINISTRATIVO, moduleId: 'services:read', isEnabled: true },
  { roleId: ROLE_IDS.AUXILIAR_ADMINISTRATIVO, moduleId: 'cashier:access', isEnabled: true },
  { roleId: ROLE_IDS.ASSISTENTE_ADMINISTRATIVO, moduleId: 'owners:read', isEnabled: true },
  { roleId: ROLE_IDS.ASSISTENTE_ADMINISTRATIVO, moduleId: 'animals:read', isEnabled: true },
  { roleId: ROLE_IDS.ASSISTENTE_ADMINISTRATIVO, moduleId: 'services:read', isEnabled: true },
  { roleId: ROLE_IDS.ASSISTENTE_ADMINISTRATIVO, moduleId: 'cashier:access', isEnabled: true },
  { roleId: ROLE_IDS.ENFERMEIRO, moduleId: 'owners:read', isEnabled: true },
  { roleId: ROLE_IDS.ENFERMEIRO, moduleId: 'animals:read', isEnabled: true },
  { roleId: ROLE_IDS.ENFERMEIRO, moduleId: 'animals:write', isEnabled: true },
  { roleId: ROLE_IDS.ENFERMEIRO, moduleId: 'services:read', isEnabled: true },
  { roleId: ROLE_IDS.ENFERMEIRO, moduleId: 'services:write', isEnabled: true },
  { roleId: ROLE_IDS.MEDICO, moduleId: 'owners:read', isEnabled: true },
  { roleId: ROLE_IDS.MEDICO, moduleId: 'animals:read', isEnabled: true },
  { roleId: ROLE_IDS.MEDICO, moduleId: 'services:read', isEnabled: true },
  { roleId: ROLE_IDS.MEDICO, moduleId: 'services:write', isEnabled: true },
  { roleId: ROLE_IDS.CONTADOR, moduleId: 'services:read', isEnabled: true },
  { roleId: ROLE_IDS.CONTADOR, moduleId: 'cashier:access', isEnabled: true },
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

const matchesRoleWhere = (role: RoleRecord, where?: RoleWhere): boolean => {
  if (!where) {
    return true;
  }

  if (where.OR?.length) {
    return where.OR.some((condition) => matchesRoleWhere(role, condition));
  }

  if (where.id && role.id !== where.id) {
    return false;
  }

  if (where.slug && role.slug !== where.slug) {
    return false;
  }

  return true;
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

const getRolesByWhere = (where?: RoleWhere) => {
  const filtered = where ? roles.filter((role) => matchesRoleWhere(role, where)) : [...roles];
  filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return filtered;
};

let modules: ModuleRecord[] = [];
let roles: RoleRecord[] = [];
let roleModules: RoleModuleRecord[] = [];
let users: UserRecord[] = [];
let owners: OwnerRecord[] = [];

const resetState = () => {
  modules = buildBaseModules();
  roles = buildBaseRoles();
  roleModules = buildBaseRoleModules();
  users = [];
  owners = [];
};

resetState();

export const createInMemoryPrisma = (): InMemoryPrisma => {
  const findUserById = (id: string) => users.find((user) => user.id === id) ?? null;
  const findUserByEmail = (email: string) => users.find((user) => user.email === email) ?? null;
  const findOwnerById = (id: string) => owners.find((owner) => owner.id === id) ?? null;
  const findOwnerByEmail = (email: string) => owners.find((owner) => owner.email === email) ?? null;
  const findOwnerByCpf = (cpf: string) => owners.find((owner) => owner.cpf === cpf) ?? null;

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
      const result = getRolesByWhere(where);
      return result.map((role) => applyRoleInclude(role, include));
    },
    async findUnique({ where, include }: RoleFindArgs): Promise<any | null> {
      if (!where) return null;
      if (where.id || where.slug) {
        const record = where.id
          ? roles.find((role) => role.id === where.id)
          : roles.find((role) => role.slug === where.slug);
        return record ? applyRoleInclude(record, include) : null;
      }
      const [record] = getRolesByWhere(where);
      return record ? applyRoleInclude(record, include) : null;
    },
    async findFirst({ where, include }: RoleFindArgs = {}): Promise<any | null> {
      const [record] = getRolesByWhere(where);
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

  const ownerClient = {
    async create({ data }: OwnerCreateArgs): Promise<any> {
      if (findOwnerByEmail(data.email)) {
        const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' as const });
        throw error;
      }

      if (data.cpf && findOwnerByCpf(data.cpf)) {
        const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' as const });
        throw error;
      }

      const now = new Date();
      const record: OwnerRecord = {
        id: data.id ?? randomUUID(),
        nome: data.nome,
        email: data.email,
        telefone: data.telefone ?? null,
        cpf: data.cpf ?? null,
        logradouro: data.logradouro ?? null,
        numero: data.numero ?? null,
        complemento: data.complemento ?? null,
        bairro: data.bairro ?? null,
        cidade: data.cidade ?? null,
        estado: data.estado ?? null,
        cep: data.cep ?? null,
        createdAt: now,
      };

      owners.push(record);
      return projectOwnerRecord(record);
    },
    async findMany({ where, select, orderBy }: OwnerFindManyArgs = {}): Promise<any[]> {
      let result = [...owners];

      if (where?.id) {
        result = result.filter((owner) => owner.id === where.id);
      }
      if (where?.email) {
        result = result.filter((owner) => owner.email === where.email);
      }
      if (where?.cpf) {
        result = result.filter((owner) => owner.cpf === where.cpf);
      }

      if (orderBy?.nome) {
        result.sort((a, b) =>
          orderBy.nome === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome),
        );
      } else if (orderBy?.createdAt) {
        result.sort((a, b) =>
          orderBy.createdAt === 'asc'
            ? a.createdAt.getTime() - b.createdAt.getTime()
            : b.createdAt.getTime() - a.createdAt.getTime(),
        );
      } else {
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }

      return result.map((owner) => projectOwnerRecord(owner, select));
    },
    async findUnique({ where, select }: OwnerFindUniqueArgs): Promise<any | null> {
      if (!where.id && !where.email && !where.cpf) {
        return null;
      }

      const record = where.id
        ? findOwnerById(where.id)
        : where.email
        ? findOwnerByEmail(where.email)
        : where.cpf
        ? findOwnerByCpf(where.cpf)
        : null;

      return record ? projectOwnerRecord(record, select) : null;
    },
    async update({ where, data }: OwnerUpdateArgs): Promise<any> {
      const existingIndex = owners.findIndex((owner) => owner.id === where.id);

      if (existingIndex < 0) {
        const error = Object.assign(new Error('Record not found'), { code: 'P2025' as const });
        throw error;
      }

      if (data.email && owners.some((owner) => owner.email === data.email && owner.id !== where.id)) {
        const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' as const });
        throw error;
      }

      if (data.cpf && owners.some((owner) => owner.cpf === data.cpf && owner.id !== where.id)) {
        const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' as const });
        throw error;
      }

      const existing = owners[existingIndex];
      const updated: OwnerRecord = {
        ...existing,
        nome: data.nome ?? existing.nome,
        email: data.email ?? existing.email,
        telefone: data.telefone ?? existing.telefone,
        cpf: data.cpf ?? existing.cpf,
        logradouro: data.logradouro ?? existing.logradouro,
        numero: data.numero ?? existing.numero,
        complemento: data.complemento ?? existing.complemento,
        bairro: data.bairro ?? existing.bairro,
        cidade: data.cidade ?? existing.cidade,
        estado: data.estado ?? existing.estado,
        cep: data.cep ?? existing.cep,
        createdAt: existing.createdAt,
      };

      owners[existingIndex] = updated;
      return projectOwnerRecord(updated);
    },
    async delete({ where }: { where: { id: string } }): Promise<any> {
      const existingIndex = owners.findIndex((owner) => owner.id === where.id);

      if (existingIndex < 0) {
        const error = Object.assign(new Error('Record not found'), { code: 'P2025' as const });
        throw error;
      }

      const [removed] = owners.splice(existingIndex, 1);
      return projectOwnerRecord(removed);
    },
    async count(): Promise<number> {
      return owners.length;
    },
  } as unknown as PrismaClient['owner'];

  const prisma = {
    user: userClient,
    module: moduleClient,
    role: roleClient,
    roleModuleAccess: roleModuleAccessClient,
    owner: ownerClient,
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
