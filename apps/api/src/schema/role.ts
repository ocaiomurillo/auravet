import { z } from 'zod';

export const roleIdParamSchema = z.object({
  id: z.string().cuid('Identificador de função inválido.'),
});

export const roleCreateSchema = z.object({
  name: z.string().min(3, 'Informe um nome com pelo menos 3 caracteres.'),
  slug: z
    .string()
    .min(3, 'Informe um identificador com pelo menos 3 caracteres.')
    .regex(/^[A-Z0-9_]+$/u, 'Use apenas letras maiúsculas, números e _ no identificador.')
    .transform((value) => value.toUpperCase()),
  description: z.string().max(200, 'Descreva em até 200 caracteres.').optional().nullable(),
  moduleIds: z.array(z.string().cuid('Identificador de módulo inválido.')).optional().default([]),
});

export const roleUpdateSchema = z
  .object({
    name: z.string().min(3, 'Informe um nome com pelo menos 3 caracteres.').optional(),
    description: z.string().max(200, 'Descreva em até 200 caracteres.').optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualização.',
  });

export const roleModuleUpdateSchema = z.object({
  modules: z
    .array(
      z.object({
        moduleId: z.string().cuid('Identificador de módulo inválido.'),
        isEnabled: z.boolean(),
      }),
    )
    .min(1, 'Informe ao menos um módulo para atualização.'),
});
