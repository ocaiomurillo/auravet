import { Prisma, Product } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import { serviceCreateSchema, serviceFilterSchema, serviceIdSchema, serviceUpdateSchema } from '../schema/service';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { isPrismaKnownError } from '../utils/prisma-error';
import { serializeService } from '../utils/serializers';

export const servicesRouter = Router();

servicesRouter.use(authenticate);

const serviceInclude = {
  animal: {
    include: {
      owner: true,
    },
  },
  items: {
    include: {
      product: true,
    },
  },
} as const;

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

type ServiceItemInput = {
  productId: string;
  quantidade: number;
  precoUnitario: number;
};

const ensureDistinctItems = (items: ServiceItemInput[]) => {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.productId)) {
      throw new HttpError(400, 'Informe cada produto apenas uma vez na lista de itens do serviço.');
    }
    seen.add(item.productId);
  }
};

const loadProductsMap = async (tx: Prisma.TransactionClient, ids: string[]): Promise<Map<string, Product>> => {
  if (!ids.length) {
    return new Map();
  }

  const products = await tx.product.findMany({
    where: { id: { in: ids } },
  });

  if (products.length !== ids.length) {
    throw new HttpError(404, 'Produto utilizado no serviço não foi encontrado.');
  }

  return new Map(products.map((product) => [product.id, product]));
};

const validateStockForCreation = async (
  tx: Prisma.TransactionClient,
  items: ServiceItemInput[],
): Promise<Map<string, Product>> => {
  const productsMap = await loadProductsMap(tx, items.map((item) => item.productId));

  for (const item of items) {
    const product = productsMap.get(item.productId);
    if (!product) continue;
    if (product.estoqueAtual < item.quantidade) {
      throw new HttpError(
        400,
        `Estoque insuficiente para o produto ${product.nome}. Disponível: ${product.estoqueAtual}.`,
      );
    }
  }

  return productsMap;
};

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(2));

servicesRouter.get(
  '/',
  requirePermission('services:read'),
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
      include: serviceInclude,
      orderBy: { data: 'desc' },
    });

    res.json(services.map((service) => serializeService(service, { includeAnimal: true })));
  }),
);

servicesRouter.post(
  '/',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const payload = serviceCreateSchema.parse(req.body);

    await ensureAnimalExists(payload.animalId);

    const items: ServiceItemInput[] = payload.items ?? [];
    ensureDistinctItems(items);

    const service = await prisma.$transaction(async (tx) => {
      await validateStockForCreation(tx, items);

      const created = await tx.servico.create({
        data: {
          animalId: payload.animalId,
          tipo: payload.tipo,
          data: parseDate(payload.data),
          preco: payload.preco,
          observacoes: payload.observacoes ?? null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantidade: item.quantidade,
              valorUnitario: toDecimal(item.precoUnitario),
              valorTotal: toDecimal(item.precoUnitario * item.quantidade),
            })),
          },
        },
        include: serviceInclude,
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { estoqueAtual: { decrement: item.quantidade } },
        });
      }

      return created;
    });

    res.status(201).json(serializeService(service, { includeAnimal: true }));
  }),
);

servicesRouter.put(
  '/:id',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const { id } = serviceIdSchema.parse(req.params);
    const payload = serviceUpdateSchema.parse(req.body);

    if (payload.animalId) {
      await ensureAnimalExists(payload.animalId);
    }

    try {
      const service = await prisma.$transaction(async (tx) => {
        const existing = await tx.servico.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!existing) {
          throw new HttpError(404, 'Serviço não encontrado.');
        }

        const updateData: Prisma.ServicoUpdateInput = {};

        if (payload.animalId !== undefined) {
          updateData.animal = { connect: { id: payload.animalId } };
        }
        if (payload.tipo !== undefined) {
          updateData.tipo = payload.tipo;
        }
        if (payload.data !== undefined) {
          updateData.data = parseDate(payload.data);
        }
        if (payload.preco !== undefined) {
          updateData.preco = payload.preco;
        }
        if (payload.observacoes !== undefined) {
          updateData.observacoes = payload.observacoes ?? null;
        }

        if (!payload.items && Object.keys(updateData).length === 0) {
          throw new HttpError(400, 'Informe ao menos um campo para atualizar.');
        }

        if (payload.items) {
          const items: ServiceItemInput[] = payload.items;
          ensureDistinctItems(items);

          const productIds = Array.from(
            new Set([
              ...existing.items.map((item) => item.productId),
              ...items.map((item) => item.productId),
            ]),
          );

          const productsMap = await loadProductsMap(tx, productIds);

          for (const previous of existing.items) {
            const product = productsMap.get(previous.productId);
            if (product) {
              product.estoqueAtual += previous.quantidade;
            }
          }

          for (const item of items) {
            const product = productsMap.get(item.productId);
            if (!product) continue;
            if (product.estoqueAtual < item.quantidade) {
              throw new HttpError(
                400,
                `Estoque insuficiente para o produto ${product.nome}. Disponível: ${product.estoqueAtual}.`,
              );
            }
            product.estoqueAtual -= item.quantidade;
          }

          for (const previous of existing.items) {
            await tx.product.update({
              where: { id: previous.productId },
              data: { estoqueAtual: { increment: previous.quantidade } },
            });
          }

          updateData.items = {
            deleteMany: {},
            create: items.map((item) => ({
              productId: item.productId,
              quantidade: item.quantidade,
              valorUnitario: toDecimal(item.precoUnitario),
              valorTotal: toDecimal(item.precoUnitario * item.quantidade),
            })),
          };

          for (const item of items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { estoqueAtual: { decrement: item.quantidade } },
            });
          }
        }

        const updated = await tx.servico.update({
          where: { id },
          data: updateData,
          include: serviceInclude,
        });

        return updated;
      });

      res.json(serializeService(service, { includeAnimal: true }));
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Serviço não encontrado.');
      }
      throw error;
    }
  }),
);

servicesRouter.delete(
  '/:id',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const { id } = serviceIdSchema.parse(req.params);

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.servico.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!existing) {
          throw new HttpError(404, 'Serviço não encontrado.');
        }

        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { estoqueAtual: { increment: item.quantidade } },
          });
        }

        await tx.servico.delete({ where: { id } });
      });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Serviço não encontrado.');
      }
      throw error;
    }

    res.status(204).send();
  }),
);
