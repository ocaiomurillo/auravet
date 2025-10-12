import { Router } from 'express';

import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { createRateLimiter } from '../middlewares/rate-limiter';
import { requirePermission } from '../middlewares/require-permission';
import { loginSchema, registerSchema } from '../schema/auth';
import { asyncHandler } from '../utils/async-handler';
import { hashPassword, verifyPassword, createAccessToken, buildAuthenticatedUser } from '../utils/auth';
import { HttpError } from '../utils/http-error';
import { isPrismaKnownError } from '../utils/prisma-error';
import { serializeUser } from '../utils/serializers';

export const authRouter = Router();

const authRateLimiter = createRateLimiter({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
});

authRouter.post(
  '/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
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
      throw new HttpError(401, 'Credenciais inválidas.');
    }

    if (!user.isActive) {
      throw new HttpError(403, 'Este usuário está inativo.');
    }

    const passwordMatches = await verifyPassword(payload.password, user.passwordHash);

    if (!passwordMatches) {
      throw new HttpError(401, 'Credenciais inválidas.');
    }

    const now = new Date();

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
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

    const authenticated = buildAuthenticatedUser(updatedUser);
    const token = createAccessToken(authenticated);

    res.json({ token, user: serializeUser(updatedUser) });
  }),
);

authRouter.post(
  '/register',
  authenticate,
  requirePermission('users:manage'),
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);

    const role = await prisma.role.findUnique({ where: { id: payload.roleId } });

    if (!role || !role.isActive) {
      throw new HttpError(400, 'Função informada está inativa ou não existe.');
    }

    const passwordHash = await hashPassword(payload.password);

    try {
      const user = await prisma.user.create({
        data: {
          nome: payload.nome,
          email: payload.email,
          passwordHash,
          roleId: payload.roleId,
        },
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

      res.status(201).json({ user: serializeUser(user) });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2002')) {
        throw new HttpError(409, 'Já existe um usuário com este e-mail.');
      }

      if (isPrismaKnownError(error, 'P2003')) {
        throw new HttpError(400, 'Função informada não existe ou está inativa.');
      }

      throw error;
    }
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, 'Sessão inválida.');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
      throw new HttpError(401, 'Sessão inválida.');
    }

    res.json({ user: serializeUser(user) });
  }),
);
