import type { Prisma } from '@prisma/client';

type KnownError = Prisma.PrismaClientKnownRequestError;

type KnownErrorCode = KnownError['code'];

export const isPrismaKnownError = (
  error: unknown,
  ...codes: KnownErrorCode[]
): error is KnownError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: unknown };

  if (typeof candidate.code !== 'string') {
    return false;
  }

  if (codes.length === 0) {
    return true;
  }

  return codes.includes(candidate.code as KnownErrorCode);
};
