import { z } from 'zod';

const serviceProfessionalValues = ['MEDICO', 'ENFERMEIRO', 'AMBOS'] as const;

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

export const serviceDefinitionCreateSchema = z.object({
  nome: z
    .string({ required_error: 'Informe o nome do serviço.' })
    .trim()
    .min(2, 'O nome do serviço deve ter ao menos 2 caracteres'),
  descricao: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined))
    .optional(),
  profissional: z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
      z.enum(serviceProfessionalValues, {
        errorMap: () => ({ message: 'Profissional inválido para o serviço.' }),
      }).optional(),
    )
    .optional(),
  tipo: z.enum(['CONSULTA', 'EXAME', 'VACINACAO', 'CIRURGIA', 'OUTROS'], {
    errorMap: () => ({ message: 'Tipo de serviço inválido' }),
  }),
  precoSugerido: precoSchema,
});

export type ServiceDefinitionCreateInput = z.input<typeof serviceDefinitionCreateSchema>;
export type ServiceDefinitionCreateOutput = z.output<typeof serviceDefinitionCreateSchema>;
