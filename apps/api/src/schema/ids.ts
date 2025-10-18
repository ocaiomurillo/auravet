import { z } from 'zod';

const cuidValueSchema = z.string().cuid();

export const isCuid = (value: string): boolean => cuidValueSchema.safeParse(value).success;

const roleSlugRegex = /^[A-Z0-9_]+$/u;
const moduleSlugRegex = /^[a-z0-9:-]+$/u;

export const roleIdentifierSchema = z.union([
  z.string().cuid('Função inválida.'),
  z
    .string()
    .regex(roleSlugRegex, 'Use apenas letras maiúsculas, números e _ no identificador.'),
]);

export const moduleIdentifierSchema = z.union([
  z.string().cuid('Identificador de módulo inválido.'),
  z
    .string()
    .regex(moduleSlugRegex, 'Identificador de módulo inválido.'),
]);
