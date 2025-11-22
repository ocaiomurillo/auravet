import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import {
  animalCreateSchema,
  animalIdSchema,
  animalListQuerySchema,
  animalUpdateSchema,
} from '../schema/animal';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { isPrismaKnownError } from '../utils/prisma-error';
import { serializeAnimal, serializeService } from '../utils/serializers';

export const animalsRouter = Router();

animalsRouter.use(authenticate);

const serviceNotesEnabled = env.SERVICE_NOTES_ENABLED;

const serviceNotesInclude = serviceNotesEnabled
  ? Prisma.validator<Prisma.ServiceNoteFindManyArgs>()({
      include: {
        author: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
  : undefined;

const parseDate = (value: string | undefined) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(422, 'Data inválida. Utilize o formato YYYY-MM-DD.');
  }
  return date;
};

animalsRouter.get(
  '/',
  requirePermission('animals:read'),
  asyncHandler(async (req, res) => {
    const query = animalListQuerySchema.parse(req.query);

    const animals = await prisma.animal.findMany({
      where: {
        ownerId: query.ownerId,
      },
      include: {
        owner: true,
        services: {
          orderBy: { data: 'desc' },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            notes: serviceNotesInclude ?? false,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(animals.map(serializeAnimal));
  }),
);

animalsRouter.post(
  '/',
  requirePermission('animals:write'),
  asyncHandler(async (req, res) => {
    const payload = animalCreateSchema.parse(req.body);

    const owner = await prisma.owner.findUnique({ where: { id: payload.ownerId } });

    if (!owner) {
      throw new HttpError(404, 'Tutor não encontrado para associar ao animal.');
    }

    const nascimento = parseDate(payload.nascimento);

    const animal = await prisma.animal.create({
      data: {
        nome: payload.nome,
        especie: payload.especie,
        raca: payload.raca,
        nascimento,
        ownerId: payload.ownerId,
      },
      include: {
        owner: true,
        services: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
            notes: serviceNotesInclude ?? false,
          },
          orderBy: { data: 'desc' },
        },
      },
    });

    res.status(201).json(serializeAnimal(animal));
  }),
);

animalsRouter.get(
  '/:id',
  requirePermission('animals:read'),
  asyncHandler(async (req, res) => {
    const { id } = animalIdSchema.parse(req.params);

    const animal = await prisma.animal.findUnique({
      where: { id },
      include: {
        owner: true,
        services: {
          orderBy: { data: 'desc' },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            notes: serviceNotesInclude ?? false,
          },
        },
      },
    });

    if (!animal) {
      throw new HttpError(404, 'Animal não encontrado.');
    }

    res.json(serializeAnimal(animal));
  }),
);

animalsRouter.get(
  '/:id/services',
  requirePermission('services:read'),
  asyncHandler(async (req, res) => {
    const { id } = animalIdSchema.parse(req.params);

    const exists = await prisma.animal.findUnique({ where: { id } });
    if (!exists) {
      throw new HttpError(404, 'Animal não encontrado.');
    }

    const services = await prisma.servico.findMany({
      where: { animalId: id },
      orderBy: { data: 'desc' },
      include: {
        appointment: true,
        items: {
          include: {
            product: true,
          },
        },
        catalogItems: {
          include: {
            definition: true,
          },
        },
        notes: serviceNotesInclude ?? false,
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });

    res.json(services.map((service) => serializeService(service)));
  }),
);

animalsRouter.put(
  '/:id',
  requirePermission('animals:write'),
  asyncHandler(async (req, res) => {
    const { id } = animalIdSchema.parse(req.params);
    const payload = animalUpdateSchema.parse(req.body);

    if (payload.ownerId) {
      const owner = await prisma.owner.findUnique({ where: { id: payload.ownerId } });
      if (!owner) {
        throw new HttpError(404, 'Tutor informado não foi encontrado.');
      }
    }

    const nascimento = parseDate(payload.nascimento);

    try {
      const animal = await prisma.animal.update({
        where: { id },
        data: {
          ...payload,
          nascimento,
        },
        include: {
          owner: true,
          services: {
            orderBy: { data: 'desc' },
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            catalogItems: {
              include: {
                definition: true,
              },
            },
            notes: serviceNotesInclude ?? false,
            responsavel: {
              select: {
                id: true,
                nome: true,
                email: true,
                },
              },
            },
          },
        },
      });

      res.json(serializeAnimal(animal));
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Animal não encontrado.');
      }
      throw error;
    }
  }),
);

animalsRouter.delete(
  '/:id',
  requirePermission('animals:write'),
  asyncHandler(async (req, res) => {
    const { id } = animalIdSchema.parse(req.params);

    try {
      await prisma.animal.delete({ where: { id } });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Animal não encontrado.');
      }
      throw error;
    }

    res.status(204).send();
  }),
);
