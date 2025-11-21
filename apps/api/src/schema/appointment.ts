import { z } from 'zod';

import { tipoServicoValues } from './service';

export const appointmentStatusValues = ['AGENDADO', 'CONFIRMADO', 'CONCLUIDO'] as const;

const dateTimeSchema = z
  .string({ required_error: 'Informe a data e hora do agendamento' })
  .datetime({ message: 'Informe uma data no formato ISO 8601 com fuso horário', offset: true });

const cuidSchema = (message: string) => z.string().cuid(message);

const priceInputSchema = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const numeric = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);

  if (!Number.isFinite(numeric)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um valor numérico válido' });
    return z.NEVER;
  }

  if (numeric < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'O valor não pode ser negativo' });
    return z.NEVER;
  }

  return Number(numeric.toFixed(2));
});

const appointmentStatusEnum = z.enum(appointmentStatusValues, {
  errorMap: () => ({ message: 'Status de agendamento inválido' }),
});

const servicePayloadSchema = z
  .object({
    tipo: z
      .enum(tipoServicoValues, {
        errorMap: () => ({ message: 'Tipo de atendimento inválido' }),
      })
      .default('CONSULTA'),
    preco: priceInputSchema.default(0),
    observacoes: z.string().max(1000).optional(),
  })
  .partial()
  .transform((value) => ({
    tipo: value.tipo ?? 'CONSULTA',
    preco: value.preco ?? 0,
    observacoes: value.observacoes?.trim() ?? undefined,
  }));

export const appointmentCreateSchema = z.object({
  animalId: cuidSchema('Animal inválido'),
  ownerId: cuidSchema('Tutor inválido').optional(),
  veterinarianId: cuidSchema('Veterinário inválido'),
  assistantId: cuidSchema('Assistente inválido').optional(),
  scheduledStart: dateTimeSchema,
  scheduledEnd: dateTimeSchema,
  status: appointmentStatusEnum.default('AGENDADO'),
  notes: z.string().max(2000).optional(),
});

export const appointmentUpdateSchema = z
  .object({
    animalId: cuidSchema('Animal inválido').optional(),
    ownerId: cuidSchema('Tutor inválido').optional(),
    veterinarianId: cuidSchema('Veterinário inválido').optional(),
    assistantId: cuidSchema('Assistente inválido').nullable().optional(),
    scheduledStart: dateTimeSchema.optional(),
    scheduledEnd: dateTimeSchema.optional(),
    status: appointmentStatusEnum.optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (data) => {
      if (data.scheduledStart && data.scheduledEnd) {
        return true;
      }

      if (!data.scheduledStart && !data.scheduledEnd) {
        return true;
      }

      return false;
    },
    {
      message: 'Para reagendar informe o horário inicial e final.',
      path: ['scheduledEnd'],
    },
  );

export const appointmentIdSchema = z.object({
  id: cuidSchema('Agendamento inválido'),
});

export const appointmentFilterSchema = z.object({
  status: appointmentStatusEnum.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  veterinarianId: cuidSchema('Colaborador inválido').optional(),
  assistantId: cuidSchema('Colaborador inválido').optional(),
  ownerId: cuidSchema('Tutor inválido').optional(),
  animalId: cuidSchema('Animal inválido').optional(),
});

export const appointmentConfirmSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const appointmentRescheduleSchema = z.object({
  scheduledStart: dateTimeSchema,
  scheduledEnd: dateTimeSchema,
  notes: z.string().max(2000).optional(),
});

export const appointmentCompleteSchema = z.object({
  notes: z.string().max(2000).optional(),
  service: servicePayloadSchema.optional(),
});

export const appointmentCalendarQuerySchema = z.object({
  view: z.enum(['day', 'week', 'month']).default('week'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  collaboratorId: cuidSchema('Colaborador inválido').optional(),
  status: appointmentStatusEnum.optional(),
});

export type AppointmentStatus = (typeof appointmentStatusValues)[number];
