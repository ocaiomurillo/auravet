import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import {
  productAdjustStockSchema,
  productCreateSchema,
  productIdSchema,
  productUpdateSchema,
} from '../schema/product';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { isPrismaKnownError } from '../utils/prisma-error';
import { serializeProduct } from '../utils/serializers';

export const productsRouter = Router();

productsRouter.use(authenticate);

productsRouter.get(
  '/',
  requirePermission('products:read'),
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      orderBy: { nome: 'asc' },
    });

    res.json(products.map(serializeProduct));
  }),
);

productsRouter.post(
  '/',
  requirePermission('products:write'),
  asyncHandler(async (req, res) => {
    const payload = productCreateSchema.parse(req.body);

    const product = await prisma.product.create({
      data: {
        nome: payload.nome,
        descricao: payload.descricao ?? null,
        custo: payload.custo,
        precoVenda: payload.precoVenda,
        estoqueAtual: payload.estoqueAtual,
        estoqueMinimo: payload.estoqueMinimo,
        isActive: payload.isActive,
        isSellable: payload.isSellable,
      },
    });

    res.status(201).json(serializeProduct(product));
  }),
);

productsRouter.get(
  '/:id',
  requirePermission('products:read'),
  asyncHandler(async (req, res) => {
    const { id } = productIdSchema.parse(req.params);

    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new HttpError(404, 'Produto não encontrado.');
    }

    res.json(serializeProduct(product));
  }),
);

productsRouter.put(
  '/:id',
  requirePermission('products:write'),
  asyncHandler(async (req, res) => {
    const { id } = productIdSchema.parse(req.params);
    const payload = productUpdateSchema.parse(req.body);

    const data: Record<string, unknown> = {};

    if (payload.nome !== undefined) {
      data.nome = payload.nome;
    }
    if (payload.descricao !== undefined) {
      data.descricao = payload.descricao ?? null;
    }
    if (payload.custo !== undefined) {
      data.custo = payload.custo;
    }
    if (payload.precoVenda !== undefined) {
      data.precoVenda = payload.precoVenda;
    }
    if (payload.estoqueAtual !== undefined) {
      data.estoqueAtual = payload.estoqueAtual;
    }
    if (payload.estoqueMinimo !== undefined) {
      data.estoqueMinimo = payload.estoqueMinimo;
    }
    if (payload.isActive !== undefined) {
      data.isActive = payload.isActive;
    }
    if (payload.isSellable !== undefined) {
      data.isSellable = payload.isSellable;
    }

    if (Object.keys(data).length === 0) {
      throw new HttpError(400, 'Informe ao menos um campo para atualizar.');
    }

    try {
      const product = await prisma.product.update({
        where: { id },
        data,
      });

      res.json(serializeProduct(product));
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Produto não encontrado.');
      }

      throw error;
    }
  }),
);

productsRouter.patch(
  '/:id/stock',
  requirePermission('products:write'),
  asyncHandler(async (req, res) => {
    const { id } = productIdSchema.parse(req.params);
    const { amount } = productAdjustStockSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new HttpError(404, 'Produto não encontrado.');
    }

    const newStock = product.estoqueAtual + amount;

    if (newStock < 0) {
      throw new HttpError(400, 'O ajuste deixaria o estoque negativo.');
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { estoqueAtual: newStock },
    });

    res.json(serializeProduct(updated));
  }),
);

productsRouter.delete(
  '/:id',
  requirePermission('products:write'),
  asyncHandler(async (req, res) => {
    const { id } = productIdSchema.parse(req.params);

    try {
      await prisma.product.delete({ where: { id } });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Produto não encontrado.');
      }

      throw error;
    }

    res.status(204).send();
  }),
);
