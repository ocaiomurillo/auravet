import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import { userIdSchema, userStatusSchema, userUpdateSchema } from '../schema/user';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { isPrismaKnownError } from '../utils/prisma-error';
import { serializeUser } from '../utils/serializers';

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.use(requirePermission('users:manage'));

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users: users.map(serializeUser) });
  }),
);

usersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = userIdSchema.parse(req.params);
    const payload = userUpdateSchema.parse(req.body);

    try {
      const user = await prisma.user.update({
        where: { id },
        data: payload,
      });

      res.json({ user: serializeUser(user) });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Usuário não encontrado.');
      }
      throw error;
    }
  }),
);

usersRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { id } = userIdSchema.parse(req.params);
    const payload = userStatusSchema.parse(req.body);

    if (!payload.isActive && req.user?.id === id) {
      throw new HttpError(400, 'Você não pode desativar a sua própria conta.');
    }

    try {
      const user = await prisma.user.update({
        where: { id },
        data: { isActive: payload.isActive },
      });

      res.json({ user: serializeUser(user) });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Usuário não encontrado.');
      }
      throw error;
    }
  }),
);
