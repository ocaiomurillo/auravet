import { z } from 'zod';

const optionalTrimmedString = z
  .string()
  .optional()
  .transform((value) => {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

export const ownerCreateSchema = z.object({
  nome: z.string().min(2, 'Informe o nome completo do tutor'),
  email: z.string().email('Informe um e-mail válido'),
  telefone: z
    .string()
    .min(8, 'Telefone deve conter ao menos 8 dígitos')
    .or(z.literal(''))
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value : undefined)),
  cpf: z
    .string({ required_error: 'Informe o CPF do tutor' })
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length === 11, 'CPF deve conter 11 dígitos'),
  logradouro: optionalTrimmedString,
  numero: optionalTrimmedString,
  complemento: optionalTrimmedString,
  bairro: optionalTrimmedString,
  cidade: optionalTrimmedString,
  estado: z
    .string()
    .optional()
    .transform((value) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const sanitized = value.trim().toUpperCase();
      return sanitized.length > 0 ? sanitized : undefined;
    })
    .refine((value) => value === undefined || /^[A-Z]{2}$/.test(value), {
      message: 'Estado deve conter 2 letras',
    }),
  cep: z
    .string()
    .optional()
    .transform((value) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const digits = value.replace(/\D/g, '');
      return digits.length > 0 ? digits : undefined;
    })
    .refine((value) => value === undefined || value.length === 8, {
      message: 'CEP deve conter 8 dígitos',
    }),
});

export const ownerUpdateSchema = ownerCreateSchema.deepPartial();

export const ownerIdSchema = z.object({
  id: z.string().cuid('Identificador inválido'),
});
