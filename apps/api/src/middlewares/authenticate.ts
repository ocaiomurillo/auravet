import type { RequestHandler } from 'express';

import { prisma } from '../lib/prisma';
import { buildAuthenticatedUser, verifyToken } from '../utils/auth';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';

const extractBearerToken = (authorization?: string | null) => {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token.trim();
};

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    throw new HttpError(401, 'Credenciais ausentes.');
  }

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            modules: {
              where: { isEnabled: true, module: { isActive: true } },
              include: { module: true },
            },
          },
        },
        collaboratorProfile: true,
      },
    });

    if (!user) {
      throw new HttpError(401, 'Sessão expirada ou inválida.');
    }

    const authenticatedUser = buildAuthenticatedUser(user);

    if (!authenticatedUser.isActive) {
      throw new HttpError(403, 'Este usuário está inativo.');
    }

    req.user = authenticatedUser;

    next();
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, 'Não foi possível validar as credenciais fornecidas.');
  }
});
