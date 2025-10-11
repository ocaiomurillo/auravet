import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { ownerCreateSchema, ownerIdSchema, ownerUpdateSchema } from '../schema/owner';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { serializeOwner } from '../utils/serializers';

export const ownersRouter = Router();

ownersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const owners = await prisma.owner.findMany({
      include: {
        animals: {
          include: {
            services: true,
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
  asyncHandler(async (req, res) => {
    const payload = ownerCreateSchema.parse(req.body);

    try {
      const owner = await prisma.owner.create({ data: payload });
      res.status(201).json(serializeOwner(owner));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'Já existe um tutor com este e-mail.');
      }
      throw error;
    }
  }),
);

ownersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = ownerIdSchema.parse(req.params);

    const owner = await prisma.owner.findUnique({
      where: { id },
      include: {
        animals: {
          include: {
            services: true,
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new HttpError(404, 'Tutor não encontrado.');
        }
        if (error.code === 'P2002') {
          throw new HttpError(409, 'Já existe um tutor com este e-mail.');
        }
      }
      throw error;
    }
  }),
);

ownersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = ownerIdSchema.parse(req.params);

    try {
      await prisma.owner.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new HttpError(404, 'Tutor não encontrado.');
      }
      throw error;
    }

    res.status(204).send();
  }),
);
