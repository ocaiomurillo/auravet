import { Role } from '@prisma/client';
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres.')
  .regex(/[A-Z]/, 'A senha deve conter ao menos uma letra maiúscula.')
  .regex(/[a-z]/, 'A senha deve conter ao menos uma letra minúscula.')
  .regex(/[0-9]/, 'A senha deve conter ao menos um número.');

export const registerSchema = z.object({
  nome: z.string().min(3, 'Informe ao menos 3 caracteres para o nome.'),
  email: z.string().email('Informe um e-mail válido.'),
  password: passwordSchema,
  role: z.nativeEnum(Role),
});

export const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});
