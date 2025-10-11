import type { PrismaClientLike } from '../lib/prisma';
import type { AuthenticatedUser } from '../utils/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }

  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClientLike | undefined;
}

export {};
