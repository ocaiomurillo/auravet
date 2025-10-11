import { z } from 'zod';

export const especieValues = ['CACHORRO', 'GATO', 'OUTROS'] as const;

export const animalCreateSchema = z.object({
  nome: z.string().min(2, 'Nome do pet é obrigatório'),
  especie: z.enum(especieValues, {
    errorMap: () => ({ message: 'Espécie inválida' }),
  }),
  raca: z.string().optional(),
  nascimento: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .or(z.literal(''))
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  ownerId: z.string().cuid('Tutor inválido'),
});

export const animalUpdateSchema = animalCreateSchema.deepPartial();

export const animalIdSchema = z.object({
  id: z.string().cuid('Animal inválido'),
});

export const animalListQuerySchema = z.object({
  ownerId: z.string().cuid().optional(),
});
