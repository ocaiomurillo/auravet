import { z } from 'zod';

const monetarySchema = z
  .union([z.number(), z.string()])
  .refine((value) => {
    const numeric = Number(value);
    return !Number.isNaN(numeric) && numeric >= 0;
  }, 'Informe um valor monetário válido')
  .transform((value) => Number(value));

const integerSchema = z
  .union([z.number(), z.string()])
  .refine((value) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= 0;
  }, 'Informe um número inteiro válido')
  .transform((value) => Number(value));

const booleanSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    return value === 'true';
  });

const descricaoSchema = z
  .string()
  .max(500, 'Descrição deve ter no máximo 500 caracteres')
  .transform((value) => value.trim())
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional()
  .or(z.null());

export const productCreateSchema = z.object({
  nome: z.string().min(2, 'Informe o nome do produto'),
  descricao: descricaoSchema,
  custo: monetarySchema,
  precoVenda: monetarySchema,
  estoqueAtual: integerSchema,
  estoqueMinimo: integerSchema,
  isActive: booleanSchema.default(true),
  isSellable: booleanSchema.default(true),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productIdSchema = z.object({
  id: z.string().cuid('Produto inválido'),
});

export const productAdjustStockSchema = z.object({
  amount: z
    .union([z.number(), z.string()])
    .refine((value) => {
      const numeric = Number(value);
      return Number.isInteger(numeric);
    }, 'Informe uma quantidade válida')
    .transform((value) => Number(value)),
});
