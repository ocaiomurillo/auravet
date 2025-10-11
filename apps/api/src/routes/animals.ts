import { Prisma } from '@prisma/client';
import { Router } from 'express';

import {
  animalCreateSchema,
  animalIdSchema,
  animalListQuerySchema,
  animalUpdateSchema,
} from '../schema/animal';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { serializeAnimal, serializeService } from '../utils/serializers';
import { prisma } from '../lib/prisma';

export const animalsRouter = Router();

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
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(animals.map(serializeAnimal));
  }),
);

animalsRouter.post(
  '/',
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
        services: true,
      },
    });

    res.status(201).json(serializeAnimal(animal));
  }),
);

animalsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = animalIdSchema.parse(req.params);

    const animal = await prisma.animal.findUnique({
      where: { id },
      include: {
        owner: true,
        services: {
          orderBy: { data: 'desc' },
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
  asyncHandler(async (req, res) => {
    const { id } = animalIdSchema.parse(req.params);

    const exists = await prisma.animal.findUnique({ where: { id } });
    if (!exists) {
      throw new HttpError(404, 'Animal não encontrado.');
    }

    const services = await prisma.servico.findMany({
      where: { animalId: id },
      orderBy: { data: 'desc' },
    });

    res.json(services.map(serializeService));
  }),
);

animalsRouter.put(
  '/:id',
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
          },
        },
      });

      res.json(serializeAnimal(animal));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new HttpError(404, 'Animal não encontrado.');
      }
      throw error;
    }
  }),
);

animalsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = animalIdSchema.parse(req.params);

    try {
      await prisma.animal.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new HttpError(404, 'Animal não encontrado.');
      }
      throw error;
    }

    res.status(204).send();
  }),
);
