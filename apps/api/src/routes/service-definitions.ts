import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import { serviceDefinitionCreateSchema } from '../schema/service-definition';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { isPrismaKnownError } from '../utils/prisma-error';

export const serviceDefinitionsRouter = Router();

serviceDefinitionsRouter.use(authenticate);

const serializeDefinition = (definition: {
  id: string;
  nome: string;
  descricao: string | null;
  profissional: string | null;
  tipo: string;
  precoSugerido: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: definition.id,
  nome: definition.nome,
  descricao: definition.descricao,
  profissional: definition.profissional,
  tipo: definition.tipo,
  precoSugerido: Number(definition.precoSugerido),
  createdAt: definition.createdAt.toISOString(),
  updatedAt: definition.updatedAt.toISOString(),
});

serviceDefinitionsRouter.get(
  '/',
  requirePermission('services:read'),
  asyncHandler(async (_req, res) => {
    const definitions = await prisma.serviceDefinition.findMany({
      where: { isActive: true },
      orderBy: { nome: 'asc' },
    });

    res.json(definitions.map((definition) => serializeDefinition(definition)));
  }),
);

serviceDefinitionsRouter.post(
  '/',
  requirePermission('services:manage'),
  asyncHandler(async (req, res) => {
    const payload = serviceDefinitionCreateSchema.parse(req.body);

    try {
      const definition = await prisma.serviceDefinition.create({
        data: {
          nome: payload.nome.trim(),
          descricao: payload.descricao?.trim() || null,
          profissional: payload.profissional?.trim() || null,
          tipo: payload.tipo,
          precoSugerido: new Prisma.Decimal(payload.precoSugerido.toFixed(2)),
        },
      });

      res.status(201).json(serializeDefinition(definition));
    } catch (error) {
      if (isPrismaKnownError(error) && error.code === 'P2002') {
        throw new HttpError(409, 'Já existe uma definição de serviço com este nome.');
      }

      throw error;
    }
  }),
);
