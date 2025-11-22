import { z } from 'zod';

export const tipoServicoValues = ['CONSULTA', 'EXAME', 'VACINACAO', 'CIRURGIA', 'OUTROS'] as const;

const toNumber = (
  value: unknown,
  ctx: z.RefinementCtx,
  { allowZero = true }: { allowZero?: boolean } = {},
): number | undefined => {
  const numeric = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);

  if (Number.isNaN(numeric)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um número válido' });
    return undefined;
  }

  if (numeric < 0 || (!allowZero && numeric === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'O valor informado precisa ser maior que zero' });
    return undefined;
  }

  return numeric;
};

export const precoSchema = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const numeric = toNumber(value, ctx);
  if (numeric === undefined) return z.NEVER;
  return Number(numeric.toFixed(2));
});

const quantidadeSchema = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const numeric = toNumber(value, ctx, { allowZero: false });
  if (numeric === undefined) return z.NEVER;
  if (!Number.isInteger(numeric)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A quantidade precisa ser um número inteiro' });
    return z.NEVER;
  }
  return numeric;
});

const serviceItemSchema = z.object({
  productId: z.string().cuid('Produto inválido'),
  quantidade: quantidadeSchema,
  precoUnitario: precoSchema,
});

const catalogItemSchema = z.object({
  serviceDefinitionId: z.string().cuid('Serviço de catálogo inválido'),
  quantidade: quantidadeSchema,
  precoUnitario: precoSchema,
  observacoes: z.string().optional(),
});

const serviceNoteSchema = z.object({
  conteudo: z
    .string()
    .trim()
    .min(1, { message: 'Informe um texto para registrar no prontuário' }),
});

export const serviceCreateSchema = z.object({
  animalId: z.string().cuid('Animal inválido'),
  appointmentId: z.string().cuid('Agendamento inválido').optional(),
  tipo: z.enum(tipoServicoValues, {
    errorMap: () => ({ message: 'Tipo de atendimento inválido' }),
  }),
  data: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  preco: precoSchema.optional(),
  observacoes: z.string().optional(),
  items: z.array(serviceItemSchema).default([]),
  catalogItems: z.array(catalogItemSchema).default([]),
  responsavelId: z.string().cuid('Responsável inválido').optional(),
  notes: z.array(serviceNoteSchema).default([]),
});

export const serviceUpdateSchema = z.object({
  animalId: z.string().cuid('Animal inválido').optional(),
  appointmentId: z.string().cuid('Agendamento inválido').optional(),
  tipo: z
    .enum(tipoServicoValues, {
      errorMap: () => ({ message: 'Tipo de atendimento inválido' }),
    })
    .optional(),
  data: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  preco: precoSchema.optional(),
  observacoes: z.string().optional(),
  items: z.array(serviceItemSchema).optional(),
  catalogItems: z.array(catalogItemSchema).optional(),
  responsavelId: z.string().cuid('Responsável inválido').optional(),
  notes: z.array(serviceNoteSchema).optional(),
});

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
