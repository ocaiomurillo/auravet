import { Prisma, Product, ServiceDefinition } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import { serviceCreateSchema, serviceFilterSchema, serviceIdSchema, serviceUpdateSchema } from '../schema/service';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { isPrismaKnownError } from '../utils/prisma-error';
import { serializeService } from '../utils/serializers';
import { syncInvoiceForService } from '../utils/invoice';

export const servicesRouter = Router();

servicesRouter.use(authenticate);

const serviceInclude = {
  animal: {
    include: {
      owner: true,
    },
  },
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
  notes: {
    include: {
      author: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  responsavel: {
    select: {
      id: true,
      nome: true,
      email: true,
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
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { id: true, ownerId: true },
  });
  if (!animal) {
    throw new HttpError(404, 'Animal não encontrado para o atendimento.');
  }
  if (!animal.ownerId) {
    throw new HttpError(400, 'Animal selecionado não possui tutor vinculado.');
  }
  return animal;
};

type ServiceItemInput = {
  productId: string;
  quantidade: number;
  precoUnitario: number;
};

type ServiceCatalogItemInput = {
  serviceDefinitionId: string;
  quantidade: number;
  precoUnitario: number;
  observacoes?: string | null;
};

const ensureDistinctItems = (items: ServiceItemInput[]) => {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.productId)) {
      throw new HttpError(400, 'Informe cada produto apenas uma vez na lista de itens do atendimento.');
    }
    seen.add(item.productId);
  }
};

const ensureDistinctCatalogItems = (items: ServiceCatalogItemInput[]) => {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.serviceDefinitionId)) {
      throw new HttpError(400, 'Selecione cada serviço do catálogo apenas uma vez. Ajuste a quantidade se necessário.');
    }
    seen.add(item.serviceDefinitionId);
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
    throw new HttpError(404, 'Produto utilizado no atendimento não foi encontrado.');
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

const loadServiceDefinitionsMap = async (
  tx: Prisma.TransactionClient,
  ids: string[],
): Promise<Map<string, ServiceDefinition>> => {
  if (!ids.length) {
    return new Map();
  }

  const definitions = await tx.serviceDefinition.findMany({
    where: { id: { in: ids }, isActive: true },
  });

  if (definitions.length !== ids.length) {
    throw new HttpError(404, 'Serviço de catálogo selecionado não foi encontrado ou está inativo.');
  }

  return new Map(definitions.map((definition) => [definition.id, definition]));
};

const ensureResponsibleExists = async (tx: Prisma.TransactionClient, userId: string) => {
  const responsible = await tx.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      role: {
        modules: {
          some: {
            isEnabled: true,
            module: { slug: 'services:write', isActive: true },
          },
        },
      },
    },
    select: { id: true },
  });

  if (!responsible) {
    throw new HttpError(404, 'Responsável informado não possui acesso ao módulo de atendimentos.');
  }
};

const calculateCatalogItemsTotal = (items: ServiceCatalogItemInput[]) =>
  items.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0);

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

servicesRouter.get(
  '/catalog',
  requirePermission('services:write'),
  asyncHandler(async (_req, res) => {
    const definitions = await prisma.serviceDefinition.findMany({
      where: { isActive: true },
      orderBy: { nome: 'asc' },
    });

    res.json({
      definitions: definitions.map((definition) => ({
        id: definition.id,
        nome: definition.nome,
        descricao: definition.descricao ?? null,
        profissional: definition.profissional ?? null,
        tipo: definition.tipo,
        precoSugerido: Number(definition.precoSugerido),
        createdAt: definition.createdAt.toISOString(),
        updatedAt: definition.updatedAt.toISOString(),
      })),
    });
  }),
);

servicesRouter.get(
  '/responsibles',
  requirePermission('services:write'),
  asyncHandler(async (_req, res) => {
    const responsibles = await prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          modules: {
            some: {
              isEnabled: true,
              module: { slug: 'services:write', isActive: true },
            },
          },
        },
      },
      select: {
        id: true,
        nome: true,
        email: true,
      },
      orderBy: { nome: 'asc' },
    });

    res.json({ responsibles });
  }),
);

servicesRouter.post(
  '/',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const payload = serviceCreateSchema.parse(req.body);

    await ensureAnimalExists(payload.animalId);

    const authorId = req.user?.id ?? null;
    const noteEntries = (payload.notes ?? [])
      .map((note) => note.conteudo.trim())
      .filter(Boolean);

    if (noteEntries.length && !authorId) {
      throw new HttpError(401, 'Usuário não autorizado a registrar entradas no prontuário.');
    }

    const items: ServiceItemInput[] = payload.items ?? [];
    ensureDistinctItems(items);

    const catalogItems: ServiceCatalogItemInput[] = payload.catalogItems ?? [];
    ensureDistinctCatalogItems(catalogItems);

    const responsibleId = payload.responsavelId ?? req.user?.id ?? null;

    const service = await prisma.$transaction(async (tx) => {
      if (responsibleId) {
        await ensureResponsibleExists(tx, responsibleId);
      }

      await validateStockForCreation(tx, items);
      await loadServiceDefinitionsMap(tx, catalogItems.map((item) => item.serviceDefinitionId));

      const catalogTotal = calculateCatalogItemsTotal(catalogItems);
      const resolvedPriceValue = payload.preco ?? catalogTotal;
      const normalizedPriceValue = Number(resolvedPriceValue.toFixed(2));

      const created = await tx.servico.create({
        data: {
          animalId: payload.animalId,
          tipo: payload.tipo,
          data: parseDate(payload.data),
          preco: toDecimal(normalizedPriceValue),
          observacoes: payload.observacoes ?? null,
          responsavelId: responsibleId,
          catalogItems: {
            create: catalogItems.map((item) => ({
              serviceDefinitionId: item.serviceDefinitionId,
              quantidade: item.quantidade,
              valorUnitario: toDecimal(item.precoUnitario),
              valorTotal: toDecimal(item.precoUnitario * item.quantidade),
              observacoes: item.observacoes?.trim() ? item.observacoes.trim() : null,
            })),
          },
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

      await syncInvoiceForService(tx, created.id, { responsibleId: created.responsavelId ?? responsibleId });

      if (noteEntries.length && authorId) {
        await tx.serviceNote.createMany({
          data: noteEntries.map((conteudo) => ({
            conteudo,
            servicoId: created.id,
            authorId,
          })),
        });
      }

      if (noteEntries.length) {
        return tx.servico.findUniqueOrThrow({ where: { id: created.id }, include: serviceInclude });
      }

      return created;
    });

    res.status(201).json(serializeService(service, { includeAnimal: true }));
  }),
);

servicesRouter.get(
  '/:id',
  requirePermission('services:read'),
  asyncHandler(async (req, res) => {
    const { id } = serviceIdSchema.parse(req.params);

    const service = await prisma.servico.findUnique({
      where: { id },
      include: serviceInclude,
    });

    if (!service) {
      throw new HttpError(404, 'Serviço não encontrado.');
    }

    res.json(serializeService(service, { includeAnimal: true }));
  }),
);

servicesRouter.put(
  '/:id',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const { id } = serviceIdSchema.parse(req.params);
    const payload = serviceUpdateSchema.parse(req.body);

    const authorId = req.user?.id ?? null;
    const noteEntries = (payload.notes ?? [])
      .map((note) => note.conteudo.trim())
      .filter(Boolean);

    if (noteEntries.length && !authorId) {
      throw new HttpError(401, 'Usuário não autorizado a registrar entradas no prontuário.');
    }

    if (payload.animalId) {
      await ensureAnimalExists(payload.animalId);
    }

    try {
      const service = await prisma.$transaction(async (tx) => {
        const existing = await tx.servico.findUnique({
          where: { id },
          include: {
            items: true,
            catalogItems: true,
            invoiceItems: {
              include: {
                invoice: {
                  include: {
                    status: true,
                  },
                },
              },
            },
          },
        });

        if (!existing) {
          throw new HttpError(404, 'Serviço não encontrado.');
        }

        const hasPaidInvoice = existing.invoiceItems?.some(
          (invoiceItem) => invoiceItem.invoice?.status.slug === 'QUITADA',
        );

        if (
          hasPaidInvoice &&
          (payload.animalId !== undefined ||
            payload.tipo !== undefined ||
            payload.data !== undefined ||
            payload.preco !== undefined ||
            payload.items !== undefined ||
            payload.catalogItems !== undefined)
        ) {
          throw new HttpError(
            400,
            'Não é possível alterar informações financeiras de um atendimento com conta quitada.',
          );
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
        if (payload.observacoes !== undefined) {
          updateData.observacoes = payload.observacoes ?? null;
        }

        let resolvedPrice: number | undefined = payload.preco;

        if (payload.catalogItems) {
          const catalogItems: ServiceCatalogItemInput[] = payload.catalogItems;
          ensureDistinctCatalogItems(catalogItems);
          await loadServiceDefinitionsMap(tx, catalogItems.map((item) => item.serviceDefinitionId));

          if (resolvedPrice === undefined) {
            resolvedPrice = calculateCatalogItemsTotal(catalogItems);
          }

          updateData.catalogItems = {
            deleteMany: {},
            create: catalogItems.map((item) => ({
              serviceDefinitionId: item.serviceDefinitionId,
              quantidade: item.quantidade,
              valorUnitario: toDecimal(item.precoUnitario),
              valorTotal: toDecimal(item.precoUnitario * item.quantidade),
              observacoes: item.observacoes?.trim() ? item.observacoes.trim() : null,
            })),
          };
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

        if (payload.responsavelId !== undefined) {
          await ensureResponsibleExists(tx, payload.responsavelId);
          updateData.responsavel = { connect: { id: payload.responsavelId } };
        }

        const hasCatalogUpdate = payload.catalogItems !== undefined;
        const hasProductUpdate = payload.items !== undefined;
        const hasFieldUpdate = Object.keys(updateData).length > 0 || resolvedPrice !== undefined;

        if (!hasCatalogUpdate && !hasProductUpdate && !hasFieldUpdate) {
          throw new HttpError(400, 'Informe ao menos um campo para atualizar.');
        }

        if (resolvedPrice !== undefined) {
          updateData.preco = toDecimal(Number(resolvedPrice.toFixed(2)));
        }

        if (noteEntries.length && authorId) {
          await tx.serviceNote.createMany({
            data: noteEntries.map((conteudo) => ({
              conteudo,
              servicoId: id,
              authorId,
            })),
          });
        }

        const updated = await tx.servico.update({
          where: { id },
          data: updateData,
          include: serviceInclude,
        });

        await syncInvoiceForService(tx, id, {
          responsibleId: updated.responsavelId ?? req.user?.id ?? null,
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
