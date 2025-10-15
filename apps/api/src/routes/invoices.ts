import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import {
  invoiceExportSchema,
  invoiceFilterSchema,
  invoiceGenerateSchema,
  invoiceIdSchema,
  invoiceItemPathSchema,
  invoiceManualItemSchema,
  invoicePaymentSchema,
} from '../schema/invoice';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { fetchInvoiceCandidates, getPaidStatus, invoiceInclude, syncInvoiceForService } from '../utils/invoice';
import { serializeInvoice } from '../utils/serializers';
import { buildInvoicePrintHtml } from '../utils/invoice-print';

export const invoicesRouter = Router();

invoicesRouter.use(authenticate);

const parseDate = (value: string, label: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(422, `Data inválida para ${label}. Utilize o formato ISO (YYYY-MM-DD).`);
  }
  return date;
};

const endOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

invoicesRouter.get(
  '/statuses',
  requirePermission('cashier:access'),
  asyncHandler(async (_req, res) => {
    const statuses = await prisma.invoiceStatus.findMany({ orderBy: { name: 'asc' } });
    res.json(
      statuses.map((status) => ({
        id: status.id,
        slug: status.slug,
        name: status.name,
      })),
    );
  }),
);

const invoiceCandidateSchema = z.object({ ownerId: z.string().cuid().optional() });

invoicesRouter.get(
  '/candidates',
  requirePermission('cashier:access'),
  asyncHandler(async (req, res) => {
    const { ownerId } = invoiceCandidateSchema.parse(req.query);
    const services = await fetchInvoiceCandidates(prisma, ownerId);
    res.json(services);
  }),
);

const buildInvoiceWhere = (filters: z.infer<typeof invoiceFilterSchema>): Prisma.InvoiceWhereInput => {
  const where: Prisma.InvoiceWhereInput = {};

  if (filters.ownerId) {
    where.ownerId = filters.ownerId;
  }

  if (filters.status) {
    where.status = { slug: filters.status };
  }

  if (filters.from || filters.to) {
    where.dueDate = {
      gte: filters.from ? parseDate(filters.from, 'data inicial') : undefined,
      lte: filters.to ? endOfDay(parseDate(filters.to, 'data final')) : undefined,
    };
  }

  return where;
};

const buildSummary = (invoices: Array<Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>>) => {
  let openTotal = new Prisma.Decimal(0);
  let paidTotal = new Prisma.Decimal(0);
  let openCount = 0;
  let paidCount = 0;

  for (const invoice of invoices) {
    if (invoice.status.slug === 'QUITADA') {
      paidTotal = paidTotal.add(invoice.total);
      paidCount += 1;
    } else {
      openTotal = openTotal.add(invoice.total);
      openCount += 1;
    }
  }

  return {
    openTotal: Number(openTotal.toFixed(2)),
    paidTotal: Number(paidTotal.toFixed(2)),
    openCount,
    paidCount,
  };
};

invoicesRouter.get(
  '/',
  requirePermission('cashier:access'),
  asyncHandler(async (req, res) => {
    const filters = invoiceFilterSchema.parse(req.query);

    const invoices = await prisma.invoice.findMany({
      where: buildInvoiceWhere(filters),
      include: invoiceInclude,
      orderBy: { dueDate: 'desc' },
    });

    res.json({
      invoices: invoices.map(serializeInvoice),
      summary: buildSummary(invoices),
    });
  }),
);

const escapeCsv = (value: string) => `"${value.replace(/"/gu, '""')}"`;

invoicesRouter.get(
  '/export',
  requirePermission('cashier:access'),
  asyncHandler(async (req, res) => {
    const filters = invoiceExportSchema.parse(req.query);

    const invoices = await prisma.invoice.findMany({
      where: buildInvoiceWhere(filters),
      include: invoiceInclude,
      orderBy: { dueDate: 'desc' },
    });

    const header = ['ID', 'Tutor', 'Status', 'Total', 'Vencimento', 'Pago em', 'Responsável'];
    const rows = invoices.map((invoice) => [
      invoice.id,
      invoice.owner.nome,
      invoice.status.name,
      invoice.total.toFixed(2),
      invoice.dueDate.toISOString(),
      invoice.paidAt ? invoice.paidAt.toISOString() : '',
      invoice.responsible?.nome ?? '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => escapeCsv(String(value))).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');
    res.send(`\ufeff${csv}`);
  }),
);

invoicesRouter.post(
  '/',
  requirePermission('cashier:access'),
  asyncHandler(async (req, res) => {
    const payload = invoiceGenerateSchema.parse(req.body);

    const dueDate = payload.dueDate ? parseDate(payload.dueDate, 'vencimento') : undefined;
    const responsibleId = req.user?.id ?? null;

    const invoice = await prisma.$transaction((tx) =>
      syncInvoiceForService(tx, payload.serviceId, {
        dueDate,
        responsibleId,
      }),
    );

    res.status(201).json(serializeInvoice(invoice));
  }),
);

invoicesRouter.post(
  '/:id/pay',
  requirePermission('cashier:access'),
  asyncHandler(async (req, res) => {
    const { id } = invoiceIdSchema.parse(req.params);
    const payload = invoicePaymentSchema.parse(req.body);

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({
        where: { id },
        include: {
          status: true,
        },
      });

      if (!existing) {
        throw new HttpError(404, 'Conta não encontrada.');
      }

      if (existing.status.slug === 'QUITADA') {
        throw new HttpError(400, 'Esta conta já está quitada.');
      }

      const paidStatus = await getPaidStatus(tx);
      const paidAt = payload.paidAt ? parseDate(payload.paidAt, 'data de pagamento') : new Date();

      return tx.invoice.update({
        where: { id },
        data: {
          statusId: paidStatus.id,
          paidAt,
          paymentNotes: payload.paymentNotes ?? null,
          responsibleId: req.user?.id ?? existing.responsibleId,
        },
        include: invoiceInclude,
      });
    });

    res.json(serializeInvoice(invoice));
  }),
);

invoicesRouter.get(
  '/:id/print',
  requirePermission('cashier:access'),
  asyncHandler(async (req, res) => {
    const { id } = invoiceIdSchema.parse(req.params);

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new HttpError(404, 'Conta não encontrada.');
    }

    const serialized = serializeInvoice(invoice);
    const html = buildInvoicePrintHtml(serialized);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }),
);

invoicesRouter.get(
  '/:id',
  requirePermission('cashier:access'),
  asyncHandler(async (req, res) => {
    const { id } = invoiceIdSchema.parse(req.params);

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new HttpError(404, 'Conta não encontrada.');
    }

    res.json(serializeInvoice(invoice));
  }),
);

const ensureInvoiceEditable = async (tx: Prisma.TransactionClient, id: string) => {
  const invoice = await tx.invoice.findUnique({
    where: { id },
    include: { status: true },
  });

  if (!invoice) {
    throw new HttpError(404, 'Conta não encontrada.');
  }

  if (invoice.status.slug === 'QUITADA') {
    throw new HttpError(400, 'Não é possível alterar uma conta que já está quitada.');
  }

  return invoice;
};

const recalculateInvoiceTotal = async (tx: Prisma.TransactionClient, invoiceId: string) => {
  const aggregate = await tx.invoiceItem.aggregate({
    where: { invoiceId },
    _sum: { total: true },
  });

  const total = aggregate._sum.total ?? new Prisma.Decimal(0);

  return tx.invoice.update({
    where: { id: invoiceId },
    data: { total },
    include: invoiceInclude,
  });
};

invoicesRouter.post(
  '/:id/items',
  requirePermission('cashier:access'),
  asyncHandler(async (req, res) => {
    const { id } = invoiceIdSchema.parse(req.params);
    const payload = invoiceManualItemSchema.parse(req.body);

    const invoice = await prisma.$transaction(async (tx) => {
      const editableInvoice = await ensureInvoiceEditable(tx, id);

      let product:
        | {
            id: string;
            nome: string;
            estoqueAtual: number;
            isSellable: boolean;
            isActive: boolean;
          }
        | null = null;
      if (payload.productId) {
        product = await tx.product.findUnique({
          where: { id: payload.productId },
          select: {
            id: true,
            nome: true,
            estoqueAtual: true,
            isSellable: true,
            isActive: true,
          },
        });

        if (!product) {
          throw new HttpError(404, 'Produto selecionado não foi encontrado.');
        }

        if (!product.isActive || !product.isSellable) {
          throw new HttpError(400, 'Este produto não está disponível para venda.');
        }

        if (product.estoqueAtual < payload.quantity) {
          throw new HttpError(
            400,
            `Estoque insuficiente para o produto ${product.nome}. Disponível: ${product.estoqueAtual}.`,
          );
        }
      }

      const description = payload.description.trim();

      const unitPrice = new Prisma.Decimal(payload.unitPrice.toFixed(2));
      const total = unitPrice.mul(payload.quantity);

      await tx.invoiceItem.create({
        data: {
          invoiceId: editableInvoice.id,
          description,
          quantity: payload.quantity,
          unitPrice,
          total,
          productId: product?.id ?? null,
          servicoId: null,
        },
      });

      if (product) {
        await tx.product.update({
          where: { id: product.id },
          data: { estoqueAtual: { decrement: payload.quantity } },
        });
      }

      return recalculateInvoiceTotal(tx, editableInvoice.id);
    });

    res.status(201).json(serializeInvoice(invoice));
  }),
);

invoicesRouter.delete(
  '/:id/items/:itemId',
  requirePermission('cashier:access'),
  asyncHandler(async (req, res) => {
    const { id, itemId } = invoiceItemPathSchema.parse(req.params);

    const invoice = await prisma.$transaction(async (tx) => {
      await ensureInvoiceEditable(tx, id);

      const item = await tx.invoiceItem.findUnique({ where: { id: itemId } });

      if (!item || item.invoiceId !== id) {
        throw new HttpError(404, 'Item não encontrado para esta conta.');
      }

      if (item.servicoId) {
        throw new HttpError(400, 'Itens vinculados a serviços não podem ser removidos manualmente.');
      }

      await tx.invoiceItem.delete({ where: { id: item.id } });

      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { estoqueAtual: { increment: item.quantity } },
        });
      }

      return recalculateInvoiceTotal(tx, id);
    });

    res.json(serializeInvoice(invoice));
  }),
);
