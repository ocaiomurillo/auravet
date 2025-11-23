import { AppointmentStatus, Prisma } from '@prisma/client';
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

const resolveServiceIdForInvoice = async (
  tx: Prisma.TransactionClient,
  payload: z.infer<typeof invoiceGenerateSchema>,
) => {
  if (payload.serviceId) {
    return payload.serviceId;
  }

  if (!payload.appointmentId) {
    throw new HttpError(400, 'Selecione um atendimento ou agendamento para faturar.');
  }

  const appointment = await tx.appointment.findUnique({ where: { id: payload.appointmentId } });

  if (!appointment) {
    throw new HttpError(404, 'Agendamento não encontrado para faturamento.');
  }

  if (appointment.status !== AppointmentStatus.CONCLUIDO) {
    throw new HttpError(400, 'Apenas agendamentos concluídos podem ser faturados.');
  }

  if (!appointment.serviceId) {
    throw new HttpError(400, 'Agendamento selecionado ainda não possui atendimento vinculado.');
  }

  return appointment.serviceId;
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

const escapeXml = (value: string) =>
  value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');

type WorksheetCell =
  | { type: 'string'; value: string }
  | { type: 'number'; value: string }
  | { type: 'date'; value: string }
  | { type: 'empty' };

const buildWorksheetXml = (rows: WorksheetCell[][]) => {
  const rowsXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell) => {
          if (cell.type === 'string') {
            return `<c t="inlineStr"><is><t>${escapeXml(cell.value)}</t></is></c>`;
          }

          if (cell.type === 'number') {
            return `<c><v>${cell.value}</v></c>`;
          }

          if (cell.type === 'date') {
            return `<c t="d"><v>${cell.value}</v></c>`;
          }

          return '<c/>';
        })
        .join('');

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
};

const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let c = i;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[i] = c >>> 0;
  }

  return table;
})();

const crc32 = (buffer: Buffer) => {
  let crc = 0 ^ -1;

  for (let offset = 0; offset < buffer.length; offset += 1) {
    const byte = buffer[offset];
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }

  return (crc ^ -1) >>> 0;
};

const buildZipArchive = (entries: Array<{ filename: string; data: Buffer | string }>) => {
  const fileParts: Buffer[] = [];
  const centralDirectoryParts: Buffer[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const fileNameBuffer = Buffer.from(entry.filename);
    const crc = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    fileParts.push(localHeader, fileNameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralDirectoryParts.push(Buffer.concat([centralHeader, fileNameBuffer]));

    offset += localHeader.length + fileNameBuffer.length + dataBuffer.length;
  });

  const centralDirectory = Buffer.concat(centralDirectoryParts);

  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, centralDirectory, endOfCentralDirectory]);
};

const buildXlsxBuffer = (rows: WorksheetCell[][]) => {
  const worksheetXml = buildWorksheetXml(rows);

  const contentTypesXml =
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';

  const relsXml =
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';

  const workbookXml =
    '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Contas" sheetId="1" r:id="rId1"/></sheets></workbook>';

  const workbookRelsXml =
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';

  return buildZipArchive([
    { filename: '[Content_Types].xml', data: contentTypesXml },
    { filename: '_rels/.rels', data: relsXml },
    { filename: 'xl/workbook.xml', data: workbookXml },
    { filename: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
    { filename: 'xl/worksheets/sheet1.xml', data: worksheetXml },
  ]);
};

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

    const xlsxRows: WorksheetCell[][] = [
      header.map((title) => ({ type: 'string', value: title })),
      ...invoices.map<WorksheetCell[]>((invoice) => [
        { type: 'string', value: invoice.id },
        { type: 'string', value: invoice.owner.nome },
        { type: 'string', value: invoice.status.name },
        { type: 'number', value: invoice.total.toString() },
        { type: 'date', value: invoice.dueDate.toISOString() },
        invoice.paidAt ? { type: 'date', value: invoice.paidAt.toISOString() } : { type: 'empty' },
        { type: 'string', value: invoice.responsible?.nome ?? '' },
      ]),
    ];

    const buffer = buildXlsxBuffer(xlsxRows);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.xlsx"');
    res.send(buffer);
  }),
);

invoicesRouter.post(
  '/',
  requirePermission('cashier:access'),
  asyncHandler(async (req, res) => {
    const payload = invoiceGenerateSchema.parse(req.body);

    const dueDate = payload.dueDate ? parseDate(payload.dueDate, 'vencimento') : undefined;
    const responsibleId = req.user?.id ?? null;
    const paymentConditionId = payload.paymentConditionId ?? null;

    const invoice = await prisma.$transaction(async (tx) => {
      const serviceId = await resolveServiceIdForInvoice(tx, payload);

      return syncInvoiceForService(tx, serviceId, {
        dueDate,
        responsibleId,
        paymentConditionId,
      });
    });

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
