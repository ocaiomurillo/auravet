import { z } from 'zod';

export const invoiceFilterSchema = z.object({
  ownerId: z.string().cuid().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const invoiceGenerateSchema = z.object({
  serviceId: z.string().cuid(),
  dueDate: z.string().optional(),
});

export const invoiceIdSchema = z.object({
  id: z.string().cuid(),
});

export const invoicePaymentSchema = z.object({
  paidAt: z.string().optional(),
  paymentNotes: z.string().max(500).optional(),
});

export const invoiceExportSchema = invoiceFilterSchema.extend({
  format: z.enum(['csv']).default('csv'),
});
