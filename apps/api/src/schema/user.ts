import { z } from 'zod';

import { roleIdentifierSchema } from './ids';

export const userIdSchema = z.object({
  id: z.string().cuid('Identificador inválido.'),
});

export const userUpdateSchema = z
  .object({
    nome: z.string().min(3, 'Informe ao menos 3 caracteres para o nome.').optional(),
    roleId: roleIdentifierSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualização.',
  });

export const userStatusSchema = z.object({
  isActive: z.boolean(),
});
