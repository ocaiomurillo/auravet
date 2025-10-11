import { z } from 'zod';

export const tipoServicoValues = ['CONSULTA', 'EXAME', 'VACINACAO', 'CIRURGIA', 'OUTROS'] as const;

const precoSchema = z
  .union([z.number(), z.string()])
  .refine((value) => {
    const numeric = Number(value);
    return !Number.isNaN(numeric) && numeric >= 0;
  }, 'Informe um preço válido');

export const serviceCreateSchema = z.object({
  animalId: z.string().cuid('Animal inválido'),
  tipo: z.enum(tipoServicoValues, {
    errorMap: () => ({ message: 'Tipo de serviço inválido' }),
  }),
  data: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  preco: precoSchema,
  observacoes: z.string().optional(),
});

export const serviceUpdateSchema = serviceCreateSchema.partial();

export const serviceIdSchema = z.object({
  id: z.string().cuid('Serviço inválido'),
});

export const serviceFilterSchema = z.object({
  animalId: z.string().cuid().optional(),
  ownerId: z.string().cuid().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
