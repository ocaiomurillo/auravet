import { z } from 'zod';

import { roleIdentifierSchema } from './ids';

export const SHIFT_VALUES = ['MANHA', 'TARDE', 'NOITE'] as const;

const collaboratorProfileTextSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) {
      return null;
    }

    return value.trim();
  });

const collaboratorShiftSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .refine((value): value is (typeof SHIFT_VALUES)[number] => SHIFT_VALUES.includes(value as (typeof SHIFT_VALUES)[number]), {
    message: 'Turno inválido informado.',
  });

export const collaboratorProfileInputSchema = z.object({
  especialidade: collaboratorProfileTextSchema.optional(),
  crmv: collaboratorProfileTextSchema.optional(),
  bio: collaboratorProfileTextSchema.optional(),
  turnos: z.array(collaboratorShiftSchema).transform((turnos) => Array.from(new Set(turnos))).optional(),
});

export type CollaboratorProfileInput = z.infer<typeof collaboratorProfileInputSchema>;

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
