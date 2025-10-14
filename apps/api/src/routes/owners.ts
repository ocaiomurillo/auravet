import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import { ownerCreateSchema, ownerIdSchema, ownerUpdateSchema } from '../schema/owner';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { isPrismaKnownError } from '../utils/prisma-error';
import { serializeOwner } from '../utils/serializers';

export const ownersRouter = Router();

const getUniqueConstraintTarget = (error: { meta?: unknown }): string | undefined => {
  if (!error.meta || typeof error.meta !== 'object') {
    return undefined;
  }

  const { target } = error.meta as { target?: unknown };

  if (Array.isArray(target)) {
    return typeof target[0] === 'string' ? target[0] : undefined;
  }

  return typeof target === 'string' ? target : undefined;
};

ownersRouter.use(authenticate);

ownersRouter.get(
  '/',
  requirePermission('owners:read'),
  asyncHandler(async (_req, res) => {
    const owners = await prisma.owner.findMany({
      include: {
        animals: {
          include: {
            services: {
              orderBy: { data: 'desc' },
              include: {
                items: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(owners.map(serializeOwner));
  }),
);

ownersRouter.post(
  '/',
  requirePermission('owners:write'),
  asyncHandler(async (req, res) => {
    const payload = ownerCreateSchema.parse(req.body);

    try {
      const owner = await prisma.owner.create({ data: payload });
      res.status(201).json(serializeOwner(owner));
    } catch (error) {
      if (isPrismaKnownError(error, 'P2002')) {
        const target = getUniqueConstraintTarget(error);

        if (target === 'cpf') {
          throw new HttpError(409, 'Já existe um tutor com este CPF.');
        }

        throw new HttpError(409, 'Já existe um tutor com este e-mail.');
      }
      throw error;
    }
  }),
);

ownersRouter.get(
  '/:id',
  requirePermission('owners:read'),
  asyncHandler(async (req, res) => {
    const { id } = ownerIdSchema.parse(req.params);

    const owner = await prisma.owner.findUnique({
      where: { id },
      include: {
        animals: {
          include: {
            services: {
              orderBy: { data: 'desc' },
              include: {
                items: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!owner) {
      throw new HttpError(404, 'Tutor não encontrado.');
    }

    res.json(serializeOwner(owner));
  }),
);

ownersRouter.put(
  '/:id',
  requirePermission('owners:write'),
  asyncHandler(async (req, res) => {
    const { id } = ownerIdSchema.parse(req.params);
    const payload = ownerUpdateSchema.parse(req.body);

    try {
      const owner = await prisma.owner.update({
        where: { id },
        data: payload,
      });
      res.json(serializeOwner(owner));
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Tutor não encontrado.');
      }
      if (isPrismaKnownError(error, 'P2002')) {
        const target = getUniqueConstraintTarget(error);

        if (target === 'cpf') {
          throw new HttpError(409, 'Já existe um tutor com este CPF.');
        }

        throw new HttpError(409, 'Já existe um tutor com este e-mail.');
      }
      throw error;
    }
  }),
);

ownersRouter.delete(
  '/:id',
  requirePermission('owners:write'),
  asyncHandler(async (req, res) => {
    const { id } = ownerIdSchema.parse(req.params);

    try {
      await prisma.owner.delete({ where: { id } });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Tutor não encontrado.');
      }
      throw error;
    }

    res.status(204).send();
  }),
);
