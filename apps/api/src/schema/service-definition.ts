import { z } from 'zod';

import { precoSchema, tipoServicoValues } from './service';

export const serviceDefinitionCreateSchema = z.object({
  nome: z
    .string({ required_error: 'Informe o nome do serviço.' })
    .trim()
    .min(2, 'O nome do serviço deve ter ao menos 2 caracteres'),
  descricao: z.string().optional(),
  profissional: z.string().optional(),
  tipo: z.enum(tipoServicoValues, { errorMap: () => ({ message: 'Tipo de serviço inválido' }) }),
  precoSugerido: precoSchema,
});
