import { z } from 'zod';

export const paymentConditionPayloadSchema = z.object({
  nome: z.string().trim().min(1, 'Dê um nome para a forma/condição.').max(120),
  prazoDias: z.number().int().nonnegative('Informe um prazo em dias válido.'),
  parcelas: z.number().int().positive('O número de parcelas deve ser maior que zero.'),
  observacoes: z.string().trim().max(500).optional(),
});

export const paymentConditionIdSchema = z.object({
  id: z.string().cuid(),
});
