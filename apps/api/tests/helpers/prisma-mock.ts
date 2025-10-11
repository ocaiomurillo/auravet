import { randomUUID } from 'node:crypto';

import type { PrismaClient, Role, User } from '@prisma/client';

export type InMemoryPrisma = PrismaClient & { reset(): void };

type UserRecord = Omit<User, 'lastLoginAt'> & { lastLoginAt: Date | null };

type UpdateData = Partial<Pick<UserRecord, 'nome' | 'email' | 'role' | 'isActive' | 'passwordHash' | 'lastLoginAt'>>;

type CreateArgs = {
  data: {
    nome: string;
    email: string;
    passwordHash: string;
    role: Role;
    isActive?: boolean;
  };
};

type UpdateArgs = {
  where: { id: string };
  data: UpdateData;
};

type FindUniqueArgs = {
  where: { id?: string; email?: string };
};

type FindManyArgs = {
  orderBy?: { createdAt: 'asc' | 'desc' };
};

const clone = <T>(value: T): T => structuredClone(value);

export const createInMemoryPrisma = (): InMemoryPrisma => {
  let users: UserRecord[] = [];

  const findById = (id: string) => users.find((user) => user.id === id) ?? null;
  const findByEmail = (email: string) => users.find((user) => user.email === email) ?? null;

  const userClient = {
    async findUnique({ where }: FindUniqueArgs): Promise<UserRecord | null> {
      if (where.id) {
        return clone(findById(where.id));
      }
      if (where.email) {
        return clone(findByEmail(where.email));
      }
      return null;
    },
    async findMany({ orderBy }: FindManyArgs = {}): Promise<UserRecord[]> {
      const sorted = [...users].sort((a, b) => {
        if (!orderBy || orderBy.createdAt === 'desc') {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      return clone(sorted);
    },
    async create({ data }: CreateArgs): Promise<UserRecord> {
      if (findByEmail(data.email)) {
        const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' as const });
        throw error;
      }

      const now = new Date();
      const record: UserRecord = {
        id: randomUUID(),
        nome: data.nome,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
      };

      users.push(record);
      return clone(record);
    },
    async update({ where, data }: UpdateArgs): Promise<UserRecord> {
      const existing = findById(where.id);
      if (!existing) {
        const error = Object.assign(new Error('Record not found'), { code: 'P2025' as const });
        throw error;
      }

      const updated: UserRecord = {
        ...existing,
        ...data,
        lastLoginAt: data.lastLoginAt ?? existing.lastLoginAt,
        updatedAt: new Date(),
      };

      users = users.map((user) => (user.id === existing.id ? updated : user));
      return clone(updated);
    },
    async deleteMany(): Promise<{ count: number }> {
      const count = users.length;
      users = [];
      return { count };
    },
  } as unknown as PrismaClient['user'];

  const prisma = {
    user: userClient,
    owner: {} as PrismaClient['owner'],
    animal: {} as PrismaClient['animal'],
    servico: {} as PrismaClient['servico'],
    reset() {
      users = [];
    },
  } as unknown as InMemoryPrisma;

  return prisma;
};
