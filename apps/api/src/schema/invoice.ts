import { z } from 'zod';

export const invoiceFilterSchema = z.object({
  ownerId: z.string().cuid().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const paymentMethodSchema = z.enum([
  'DINHEIRO',
  'CARTAO_CREDITO',
  'CARTAO_DEBITO',
  'PIX',
  'BOLETO',
  'OUTROS',
]);

export const paymentConditionSchema = z.enum([
  'A_VISTA',
  'DIAS_30',
  'DIAS_60',
  'CARTAO_2X',
  'CARTAO_3X',
]);

export const invoiceGenerateSchema = z
  .object({
    serviceId: z.string().cuid().optional(),
    appointmentId: z.string().cuid().optional(),
    dueDate: z.string().optional(),
  })
  .refine((value) => Boolean(value.serviceId || value.appointmentId), {
    message: 'Informe um atendimento ou agendamento para gerar a conta.',
    path: ['serviceId'],
  });

export const invoiceIdSchema = z.object({
  id: z.string().cuid(),
});

export const invoiceInstallmentSchema = z.object({
  dueDate: z.string(),
  amount: z.number().positive('Informe um valor válido para a parcela.'),
  paidAt: z.string().optional(),
});

export const invoicePaymentSchema = z.object({
  paymentMethod: paymentMethodSchema,
  paymentCondition: paymentConditionSchema,
  installments: z.array(invoiceInstallmentSchema).min(1, 'Informe ao menos uma parcela.'),
  paymentNotes: z.string().max(500).optional(),
});

export const invoiceManualItemSchema = z.object({
  description: z.string().trim().min(1, 'Informe uma descrição para o item.').max(200),
  quantity: z.number().int().positive('Informe uma quantidade válida.'),
  unitPrice: z.number().nonnegative('O valor unitário deve ser positivo.'),
  productId: z.string().cuid().optional(),
});

export const invoiceItemPathSchema = z.object({
  id: z.string().cuid(),
  itemId: z.string().cuid(),
});

export const invoiceExportSchema = invoiceFilterSchema;
