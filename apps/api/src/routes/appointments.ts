import { AppointmentStatus as PrismaAppointmentStatus, Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import {
  appointmentCalendarQuerySchema,
  appointmentCompleteSchema,
  appointmentConfirmSchema,
  appointmentCreateSchema,
  appointmentFilterSchema,
  appointmentIdSchema,
  appointmentRescheduleSchema,
  appointmentUpdateSchema,
} from '../schema/appointment';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import {
  AppointmentAvailability,
  SerializedAppointment,
  serializeAppointment,
  serializeAppointmentUser,
} from '../utils/serializers';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);

const appointmentInclude = {
  animal: {
    include: {
      owner: true,
    },
  },
  owner: true,
  veterinarian: {
    include: {
      role: true,
      collaboratorProfile: true,
    },
  },
  assistant: {
    include: {
      role: true,
      collaboratorProfile: true,
    },
  },
  service: {
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  },
} as const;

type AppointmentWithAllRelations = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

type CollaboratorUser = Prisma.UserGetPayload<{
  include: {
    role: true;
    collaboratorProfile: true;
  };
}>;

const defaultAvailability: AppointmentAvailability = {
  veterinarianConflict: false,
  assistantConflict: false,
};

const ensureEndAfterStart = (start: Date, end: Date) => {
  if (end <= start) {
    throw new HttpError(400, 'O horário final precisa ser posterior ao horário inicial.');
  }
};

const normalizeNotes = (notes?: string) => {
  if (notes === undefined) return undefined;
  const trimmed = notes.trim();
  return trimmed.length ? trimmed : null;
};

const ensureAnimalExists = async (animalId: string) => {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    include: { owner: true },
  });

  if (!animal) {
    throw new HttpError(404, 'Animal não encontrado para o agendamento.');
  }

  return animal;
};

const ensureOwnerMatchesAnimal = (providedOwnerId: string | undefined, animalOwnerId: string) => {
  if (!providedOwnerId) {
    return animalOwnerId;
  }

  if (providedOwnerId !== animalOwnerId) {
    throw new HttpError(400, 'Tutor informado não corresponde ao animal selecionado.');
  }

  return providedOwnerId;
};

const ensureCollaboratorExists = async (userId: string, { requireProfile = true } = {}) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      collaboratorProfile: true,
    },
  });

  if (!user) {
    throw new HttpError(404, 'Colaborador informado não foi encontrado.');
  }

  if (!user.isActive) {
    throw new HttpError(400, 'Colaborador informado está inativo.');
  }

  if (requireProfile && !user.collaboratorProfile) {
    throw new HttpError(400, 'Colaborador informado não possui perfil completo.');
  }

  return user;
};

const computeAvailabilityMap = (appointments: AppointmentWithAllRelations[]) => {
  const map = new Map<string, AppointmentAvailability>();

  for (const appointment of appointments) {
    map.set(appointment.id, { ...defaultAvailability });
  }

  const relevant = appointments.filter(
    (appointment) => appointment.status !== PrismaAppointmentStatus.CONCLUIDO,
  );

  const detectConflicts = (key: 'veterinarianId' | 'assistantId') => {
    const grouped = new Map<string, AppointmentWithAllRelations[]>();

    for (const appointment of relevant) {
      const collaboratorId = appointment[key];
      if (!collaboratorId) continue;

      if (!grouped.has(collaboratorId)) {
        grouped.set(collaboratorId, []);
      }

      grouped.get(collaboratorId)!.push(appointment);
    }

    for (const [, group] of grouped) {
      group.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());

      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const current = group[i];
          const next = group[j];

          if (next.scheduledStart >= current.scheduledEnd) {
            break;
          }

          const currentAvailability = map.get(current.id);
          const nextAvailability = map.get(next.id);

          if (key === 'veterinarianId') {
            if (currentAvailability) currentAvailability.veterinarianConflict = true;
            if (nextAvailability) nextAvailability.veterinarianConflict = true;
          } else {
            if (currentAvailability) currentAvailability.assistantConflict = true;
            if (nextAvailability) nextAvailability.assistantConflict = true;
          }
        }
      }
    }
  };

  detectConflicts('veterinarianId');
  detectConflicts('assistantId');

  return map;
};

const fetchAppointmentsWithAvailability = async (
  where: Prisma.AppointmentWhereInput,
  orderBy: Prisma.AppointmentOrderByWithRelationInput = { scheduledStart: 'asc' },
): Promise<SerializedAppointment[]> => {
  const appointments = await prisma.appointment.findMany({
    where,
    include: appointmentInclude,
    orderBy,
  });

  const availabilityMap = computeAvailabilityMap(appointments);

  return appointments.map((appointment) =>
    serializeAppointment(appointment, availabilityMap.get(appointment.id) ?? defaultAvailability),
  );
};

const detectScheduleConflicts = async (args: {
  appointmentId?: string;
  veterinarianId: string;
  assistantId?: string | null;
  scheduledStart: Date;
  scheduledEnd: Date;
}) => {
  const baseWhere: Prisma.AppointmentWhereInput = {
    status: { in: [PrismaAppointmentStatus.AGENDADO, PrismaAppointmentStatus.CONFIRMADO] },
    scheduledStart: { lt: args.scheduledEnd },
    scheduledEnd: { gt: args.scheduledStart },
    id: args.appointmentId ? { not: args.appointmentId } : undefined,
  };

  const [vetConflict, assistantConflict] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        ...baseWhere,
        veterinarianId: args.veterinarianId,
      },
    }),
    args.assistantId
      ? prisma.appointment.findFirst({
          where: {
            ...baseWhere,
            assistantId: args.assistantId,
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    veterinarianConflict: Boolean(vetConflict),
    assistantConflict: Boolean(assistantConflict),
  } satisfies AppointmentAvailability;
};

const toDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(422, 'Data inválida informada.');
  }
  return date;
};

const toStartOfDayUTC = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const toEndOfDayUTC = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

const SHIFT_CAPACITY: Record<string, number> = {
  MANHA: 4,
  TARDE: 4,
  NOITE: 4,
};

const calculateRange = (view: 'day' | 'week' | 'month', reference: Date) => {
  if (view === 'day') {
    const start = toStartOfDayUTC(reference);
    const end = toEndOfDayUTC(reference);
    return { start, end };
  }

  if (view === 'week') {
    const dayOfWeek = reference.getUTCDay();
    const diff = (dayOfWeek + 6) % 7;
    const start = new Date(reference);
    start.setUTCDate(reference.getUTCDate() - diff);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { start: toStartOfDayUTC(start), end: toEndOfDayUTC(end) };
  }

  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
};

appointmentsRouter.get(
  '/',
  requirePermission('services:read'),
  asyncHandler(async (req, res) => {
    const filters = appointmentFilterSchema.parse(req.query);

    const where: Prisma.AppointmentWhereInput = {
      status: filters.status,
      veterinarianId: filters.veterinarianId,
      assistantId: filters.assistantId,
      ownerId: filters.ownerId,
      animalId: filters.animalId,
    };

    const dateFilter: Prisma.DateTimeFilter = {};

    if (filters.from) {
      dateFilter.gte = toStartOfDayUTC(toDate(`${filters.from}T00:00:00Z`));
    }

    if (filters.to) {
      dateFilter.lte = toEndOfDayUTC(toDate(`${filters.to}T00:00:00Z`));
    }

    if (Object.keys(dateFilter).length > 0) {
      where.scheduledStart = dateFilter;
    }

    const appointments = await fetchAppointmentsWithAvailability(where, { scheduledStart: 'asc' });

    res.json({ appointments });
  }),
);

appointmentsRouter.post(
  '/',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const payload = appointmentCreateSchema.parse(req.body);

    const scheduledStart = toDate(payload.scheduledStart);
    const scheduledEnd = toDate(payload.scheduledEnd);
    ensureEndAfterStart(scheduledStart, scheduledEnd);

    const animal = await ensureAnimalExists(payload.animalId);
    const ownerId = ensureOwnerMatchesAnimal(payload.ownerId, animal.ownerId);

    await ensureCollaboratorExists(payload.veterinarianId);
    if (payload.assistantId) {
      await ensureCollaboratorExists(payload.assistantId, { requireProfile: false });
    }

    const now = new Date();
    const status = payload.status;
    const confirmedAt =
      status === PrismaAppointmentStatus.CONFIRMADO || status === PrismaAppointmentStatus.CONCLUIDO
        ? now
        : null;
    const completedAt = status === PrismaAppointmentStatus.CONCLUIDO ? now : null;

    const appointment = await prisma.appointment.create({
      data: {
        animalId: payload.animalId,
        ownerId,
        veterinarianId: payload.veterinarianId,
        assistantId: payload.assistantId ?? null,
        status,
        confirmedAt,
        completedAt,
        scheduledStart,
        scheduledEnd,
        notes: normalizeNotes(payload.notes),
      },
      include: appointmentInclude,
    });

    const availability = await detectScheduleConflicts({
      appointmentId: appointment.id,
      veterinarianId: appointment.veterinarianId,
      assistantId: appointment.assistantId,
      scheduledStart,
      scheduledEnd,
    });

    res.status(201).json({ appointment: serializeAppointment(appointment, availability) });
  }),
);

appointmentsRouter.get(
  '/collaborators',
  requirePermission('services:read'),
  asyncHandler(async (_req, res) => {
    const collaborators = (await prisma.user.findMany({
      where: {
        isActive: true,
        collaboratorProfile: {
          isNot: null,
        },
      },
      orderBy: { nome: 'asc' },
      include: {
        role: true,
        collaboratorProfile: true,
      },
    })) as CollaboratorUser[];

    res.json({ collaborators: collaborators.map((user) => serializeAppointmentUser(user)) });
  }),
);

appointmentsRouter.get(
  '/calendar',
  requirePermission('services:read'),
  asyncHandler(async (req, res) => {
    const query = appointmentCalendarQuerySchema.parse(req.query);

    const baseDate = query.date ? toDate(`${query.date}T00:00:00Z`) : new Date();
    const { start, end } = calculateRange(query.view, baseDate);

    const where: Prisma.AppointmentWhereInput = {
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
      status: query.status,
    };

    if (query.collaboratorId) {
      where.OR = [{ veterinarianId: query.collaboratorId }, { assistantId: query.collaboratorId }];
    }

    const appointments = await fetchAppointmentsWithAvailability(where, { scheduledStart: 'asc' });

    let capacity: {
      totalSlots: number | null;
      bookedSlots: number;
      availableSlots: number | null;
    } = { totalSlots: null, bookedSlots: 0, availableSlots: null };

    if (query.collaboratorId) {
      const collaborator = await ensureCollaboratorExists(query.collaboratorId, { requireProfile: false });
      const turnos = collaborator.collaboratorProfile?.turnos ?? [];
      const normalizedTurnos = turnos.map((turno) => turno.toUpperCase());
      const slotsPerDay = normalizedTurnos.reduce<number>(
        (sum, turno) => sum + (SHIFT_CAPACITY[turno] ?? 2),
        0,
      );

      const daysInRange = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const totalSlots = slotsPerDay * Math.max(daysInRange, 1);
      const bookedSlots = appointments.filter(
        (appointment) => appointment.status !== PrismaAppointmentStatus.CONCLUIDO,
      ).length;

      capacity = {
        totalSlots,
        bookedSlots,
        availableSlots: Math.max(totalSlots - bookedSlots, 0),
      };
    } else {
      capacity = {
        totalSlots: null,
        bookedSlots: appointments.filter(
          (appointment) => appointment.status !== PrismaAppointmentStatus.CONCLUIDO,
        ).length,
        availableSlots: null,
      };
    }

    res.json({
      view: query.view,
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      appointments,
      summary: {
        total: appointments.length,
        confirmed: appointments.filter((appointment) => appointment.status === PrismaAppointmentStatus.CONFIRMADO)
          .length,
        concluded: appointments.filter((appointment) => appointment.status === PrismaAppointmentStatus.CONCLUIDO)
          .length,
        pending: appointments.filter((appointment) => appointment.status === PrismaAppointmentStatus.AGENDADO)
          .length,
        capacity,
      },
    });
  }),
);

appointmentsRouter.get(
  '/:id',
  requirePermission('services:read'),
  asyncHandler(async (req, res) => {
    const { id } = appointmentIdSchema.parse(req.params);

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });

    if (!appointment) {
      throw new HttpError(404, 'Agendamento não encontrado.');
    }

    const orConditions: Prisma.AppointmentWhereInput[] = [
      { veterinarianId: appointment.veterinarianId },
    ];

    if (appointment.assistantId) {
      orConditions.push({ assistantId: appointment.assistantId });
    }

    const relatedAppointments = await prisma.appointment.findMany({
      where: { OR: orConditions },
      include: appointmentInclude,
    });

    const availabilityMap = computeAvailabilityMap(relatedAppointments);

    res.json({
      appointment: serializeAppointment(
        appointment,
        availabilityMap.get(appointment.id) ?? defaultAvailability,
      ),
    });
  }),
);

appointmentsRouter.put(
  '/:id',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const { id } = appointmentIdSchema.parse(req.params);
    const payload = appointmentUpdateSchema.parse(req.body);

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new HttpError(404, 'Agendamento não encontrado.');
    }

    const data: Prisma.AppointmentUpdateInput = {};
    let scheduledStart = appointment.scheduledStart;
    let scheduledEnd = appointment.scheduledEnd;

    if (payload.animalId) {
      const animal = await ensureAnimalExists(payload.animalId);
      const ownerId = ensureOwnerMatchesAnimal(payload.ownerId, animal.ownerId);
      data.animal = { connect: { id: payload.animalId } };
      data.owner = { connect: { id: ownerId } };
    } else if (payload.ownerId) {
      const animal = await ensureAnimalExists(appointment.animalId);
      ensureOwnerMatchesAnimal(payload.ownerId, animal.ownerId);
      data.owner = { connect: { id: payload.ownerId } };
    }

    if (payload.veterinarianId) {
      await ensureCollaboratorExists(payload.veterinarianId);
      data.veterinarian = { connect: { id: payload.veterinarianId } };
    }

    if (payload.assistantId !== undefined) {
      if (payload.assistantId === null) {
        data.assistant = { disconnect: true };
      } else {
        await ensureCollaboratorExists(payload.assistantId, { requireProfile: false });
        data.assistant = { connect: { id: payload.assistantId } };
      }
    }

    if (payload.scheduledStart && payload.scheduledEnd) {
      scheduledStart = toDate(payload.scheduledStart);
      scheduledEnd = toDate(payload.scheduledEnd);
      ensureEndAfterStart(scheduledStart, scheduledEnd);
      data.scheduledStart = scheduledStart;
      data.scheduledEnd = scheduledEnd;
    }

    if (payload.notes !== undefined) {
      data.notes = normalizeNotes(payload.notes);
    }

    if (payload.status) {
      data.status = payload.status;

      if (payload.status === PrismaAppointmentStatus.AGENDADO) {
        data.confirmedAt = null;
        data.completedAt = null;
      } else if (payload.status === PrismaAppointmentStatus.CONFIRMADO) {
        data.confirmedAt = appointment.confirmedAt ?? new Date();
        data.completedAt = null;
      } else if (payload.status === PrismaAppointmentStatus.CONCLUIDO) {
        data.confirmedAt = appointment.confirmedAt ?? new Date();
        data.completedAt = new Date();
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data,
      include: appointmentInclude,
    });

    const availability = await detectScheduleConflicts({
      appointmentId: updated.id,
      veterinarianId: updated.veterinarianId,
      assistantId: updated.assistantId,
      scheduledStart,
      scheduledEnd,
    });

    res.json({ appointment: serializeAppointment(updated, availability) });
  }),
);

appointmentsRouter.patch(
  '/:id/confirm',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const { id } = appointmentIdSchema.parse(req.params);
    const payload = appointmentConfirmSchema.parse(req.body);

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: PrismaAppointmentStatus.CONFIRMADO,
        confirmedAt: new Date(),
        notes: normalizeNotes(payload.notes),
      },
      include: appointmentInclude,
    });

    const availability = await detectScheduleConflicts({
      appointmentId: updated.id,
      veterinarianId: updated.veterinarianId,
      assistantId: updated.assistantId,
      scheduledStart: updated.scheduledStart,
      scheduledEnd: updated.scheduledEnd,
    });

    res.json({ appointment: serializeAppointment(updated, availability) });
  }),
);

appointmentsRouter.patch(
  '/:id/reschedule',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const { id } = appointmentIdSchema.parse(req.params);
    const payload = appointmentRescheduleSchema.parse(req.body);

    const scheduledStart = toDate(payload.scheduledStart);
    const scheduledEnd = toDate(payload.scheduledEnd);
    ensureEndAfterStart(scheduledStart, scheduledEnd);

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        scheduledStart,
        scheduledEnd,
        status: PrismaAppointmentStatus.AGENDADO,
        confirmedAt: null,
        notes: normalizeNotes(payload.notes),
      },
      include: appointmentInclude,
    });

    const availability = await detectScheduleConflicts({
      appointmentId: updated.id,
      veterinarianId: updated.veterinarianId,
      assistantId: updated.assistantId,
      scheduledStart,
      scheduledEnd,
    });

    res.json({ appointment: serializeAppointment(updated, availability) });
  }),
);

const toDecimal = (value: number) => new Prisma.Decimal(value.toFixed(2));

appointmentsRouter.patch(
  '/:id/complete',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const { id } = appointmentIdSchema.parse(req.params);
    const payload = appointmentCompleteSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.appointment.findUnique({
        where: { id },
        include: appointmentInclude,
      });

      if (!existing) {
        throw new HttpError(404, 'Agendamento não encontrado.');
      }

      const now = new Date();
      const data: Prisma.AppointmentUpdateInput = {
        status: PrismaAppointmentStatus.CONCLUIDO,
        confirmedAt: existing.confirmedAt ?? now,
        completedAt: now,
      };

      if (payload.notes !== undefined) {
        data.notes = normalizeNotes(payload.notes);
      }

      if (!existing.serviceId) {
        const servicePayload = payload.service ?? { tipo: 'CONSULTA', preco: 0, observacoes: undefined };

        const createdService = await tx.servico.create({
          data: {
            animalId: existing.animalId,
            tipo: servicePayload.tipo ?? 'CONSULTA',
            data: now,
            preco: toDecimal(servicePayload.preco ?? 0),
            observacoes:
              servicePayload.observacoes ?? normalizeNotes(payload.notes ?? existing.notes ?? undefined) ?? null,
          },
        });

        data.service = { connect: { id: createdService.id } };
      } else if (payload.service) {
        await tx.servico.update({
          where: { id: existing.serviceId },
          data: {
            tipo: payload.service.tipo ?? 'CONSULTA',
            preco: toDecimal(payload.service.preco ?? 0),
            observacoes:
              payload.service.observacoes ?? normalizeNotes(payload.notes ?? existing.notes ?? undefined) ?? null,
          },
        });
      }

      const updated = await tx.appointment.update({
        where: { id },
        data,
        include: appointmentInclude,
      });

      return updated;
    });

    const availability = await detectScheduleConflicts({
      appointmentId: result.id,
      veterinarianId: result.veterinarianId,
      assistantId: result.assistantId,
      scheduledStart: result.scheduledStart,
      scheduledEnd: result.scheduledEnd,
    });

    res.json({ appointment: serializeAppointment(result, availability) });
  }),
);

appointmentsRouter.delete(
  '/:id',
  requirePermission('services:write'),
  asyncHandler(async (req, res) => {
    const { id } = appointmentIdSchema.parse(req.params);

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { service: true },
    });

    if (!appointment) {
      throw new HttpError(404, 'Agendamento não encontrado.');
    }

    if (appointment.serviceId) {
      throw new HttpError(
        400,
        'Não é possível excluir um agendamento que já está vinculado a um serviço concluído.',
      );
    }

    await prisma.appointment.delete({ where: { id } });

    res.status(204).send();
  }),
);
