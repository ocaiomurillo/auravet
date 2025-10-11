import { z } from 'zod';

export const ownerCreateSchema = z.object({
  nome: z.string().min(2, 'Informe o nome completo do tutor'),
  email: z.string().email('Informe um e-mail válido'),
  telefone: z
    .string()
    .min(8, 'Telefone deve conter ao menos 8 dígitos')
    .or(z.literal(''))
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value : undefined)),
});

export const ownerUpdateSchema = ownerCreateSchema.deepPartial();

export const ownerIdSchema = z.object({
  id: z.string().cuid('Identificador inválido'),
});
