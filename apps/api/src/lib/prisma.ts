import { PrismaClient } from '@prisma/client';

export type PrismaClientLike = PrismaClient;

const globalForPrisma = globalThis as typeof globalThis & {
  __PRISMA__?: PrismaClientLike;
};

if (!globalForPrisma.__PRISMA__) {
  globalForPrisma.__PRISMA__ = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
}

export const prisma = globalForPrisma.__PRISMA__!;

export const setPrismaClient = (client: PrismaClientLike) => {
  globalForPrisma.__PRISMA__ = client;
};
