import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { serviceCreateSchema, serviceFilterSchema, serviceIdSchema, serviceUpdateSchema } from '../schema/service';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { serializeService } from '../utils/serializers';

export const servicesRouter = Router();

const parseDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(422, 'Data inválida. Utilize o formato YYYY-MM-DD.');
  }
  return date;
};

const ensureAnimalExists = async (animalId: string) => {
  const animal = await prisma.animal.findUnique({ where: { id: animalId } });
  if (!animal) {
    throw new HttpError(404, 'Animal não encontrado para o serviço.');
  }
};

servicesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = serviceFilterSchema.parse(req.query);

    const services = await prisma.servico.findMany({
      where: {
        animalId: filters.animalId,
        animal: filters.ownerId
          ? {
              ownerId: filters.ownerId,
            }
          : undefined,
        data: {
          gte: filters.from ? parseDate(filters.from) : undefined,
          lte: filters.to ? parseDate(filters.to) : undefined,
        },
      },
      include: {
        animal: {
          include: {
            owner: true,
          },
        },
      },
      orderBy: { data: 'desc' },
    });

    res.json(services.map((service) => serializeService(service, { includeAnimal: true })));
  }),
);

servicesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = serviceCreateSchema.parse(req.body);

    await ensureAnimalExists(payload.animalId);

    const service = await prisma.servico.create({
      data: {
        animalId: payload.animalId,
        tipo: payload.tipo,
        data: parseDate(payload.data),
        preco: Number(payload.preco),
        observacoes: payload.observacoes,
      },
      include: {
        animal: {
          include: {
            owner: true,
          },
        },
      },
    });

    res.status(201).json(serializeService(service, { includeAnimal: true }));
  }),
);

servicesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = serviceIdSchema.parse(req.params);
    const payload = serviceUpdateSchema.parse(req.body);

    if (payload.animalId) {
      await ensureAnimalExists(payload.animalId);
    }

    const data = payload.data ? parseDate(payload.data) : undefined;

    try {
      const service = await prisma.servico.update({
        where: { id },
        data: {
          ...payload,
          data,
          preco: payload.preco !== undefined ? Number(payload.preco) : undefined,
        },
        include: {
          animal: {
            include: {
              owner: true,
            },
          },
        },
      });

      res.json(serializeService(service, { includeAnimal: true }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new HttpError(404, 'Serviço não encontrado.');
      }
      throw error;
    }
  }),
);

servicesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = serviceIdSchema.parse(req.params);

    try {
      await prisma.servico.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new HttpError(404, 'Serviço não encontrado.');
      }
      throw error;
    }

    res.status(204).send();
  }),
);
