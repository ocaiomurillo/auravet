import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { PaymentMethod } from '@prisma/client';
import { PaymentConditionType } from '@prisma/client';
import * as PrismaModule from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import type { InMemoryPrisma } from './helpers/prisma-mock';
import { createInMemoryPrisma } from './helpers/prisma-mock';

import { appointmentUpdateSchema } from '../src/schema/appointment';

const { Prisma } = PrismaModule;

const isDecimal = (value: unknown): value is Decimal => value instanceof Decimal;

const toDecimal = (value: number | Decimal) => (isDecimal(value) ? value : new Decimal(value));

(Prisma as unknown as { Decimal: typeof Decimal }).Decimal = Decimal;
(PrismaModule as unknown as { AppointmentStatus: Record<string, string> }).AppointmentStatus ??= {
  AGENDADO: 'AGENDADO',
  CONFIRMADO: 'CONFIRMADO',
  CONCLUIDO: 'CONCLUIDO',
};

type AnimalRecord = {
  id: string;
  nome: string;
  especie: 'CACHORRO' | 'GATO' | 'OUTROS';
  ownerId: string;
  raca: string | null;
  nascimento: Date | null;
  createdAt: Date;
};

type ServiceCatalogItemRecord = {
  id: string;
  servicoId: string;
  serviceDefinitionId: string;
  quantidade: number;
  valorUnitario: Decimal;
  valorTotal: Decimal;
  observacoes: string | null;
};

type ServiceProductUsageRecord = {
  id: string;
  servicoId: string;
  productId: string;
  quantidade: number;
  valorUnitario: Decimal;
  valorTotal: Decimal;
};

type ServiceRecord = {
  id: string;
  animalId: string;
  tipo: string;
  data: Date;
  preco: Decimal;
  observacoes: string | null;
  responsavelId: string | null;
  catalogItems: ServiceCatalogItemRecord[];
  items: ServiceProductUsageRecord[];
  invoiceItemIds: string[];
  createdAt: Date;
};

type AppointmentRecord = {
  id: string;
  animalId: string;
  ownerId: string;
  veterinarianId: string;
  assistantId: string | null;
  serviceId: string | null;
  status: 'AGENDADO' | 'CONFIRMADO' | 'CONCLUIDO';
  scheduledStart: Date;
  scheduledEnd: Date;
  confirmedAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InvoiceRecord = {
  id: string;
  ownerId: string;
  statusId: string;
  responsibleId: string | null;
  paymentMethod: PaymentMethod | null;
  paymentConditionId: string | null;
  paymentConditionType: PaymentConditionType | null;
  total: Decimal;
  dueDate: Date;
  paidAt: Date | null;
  paymentNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemIds: string[];
};

type PaymentConditionRecord = {
  id: string;
  nome: string;
  prazoDias: number;
  parcelas: number;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InvoiceInstallmentRecord = {
  id: string;
  invoiceId: string;
  dueDate: Date;
  amount: Decimal;
  paidAt: Date | null;
};

type InvoiceItemRecord = {
  id: string;
  invoiceId: string;
  servicoId: string | null;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: Decimal;
  total: Decimal;
  createdAt: Date;
};

type InvoiceStatusRecord = {
  id: string;
  slug: string;
  name: string;
};

const animals: AnimalRecord[] = [];
const services: ServiceRecord[] = [];
const appointments: AppointmentRecord[] = [];
const invoices: InvoiceRecord[] = [];
const invoiceItems: InvoiceItemRecord[] = [];
const invoiceInstallments: InvoiceInstallmentRecord[] = [];
const paymentConditions: PaymentConditionRecord[] = [];
const invoiceStatuses: InvoiceStatusRecord[] = [];

const generateId = () => `c${randomUUID().replace(/-/g, '').slice(0, 24)}`;

const toDateInstance = (value: Date | string) => (value instanceof Date ? value : new Date(value));

const matchesPrimitiveFilter = <T extends string | null>(value: T, filter: any): boolean => {
  if (filter === undefined) {
    return true;
  }

  if (filter === null || typeof filter !== 'object') {
    return value === filter;
  }

  if (Object.prototype.hasOwnProperty.call(filter, 'equals') && !matchesPrimitiveFilter(value, filter.equals)) {
    return false;
  }

  if (Array.isArray(filter.in) && !filter.in.includes(value)) {
    return false;
  }

  if (Array.isArray(filter.notIn) && filter.notIn.includes(value)) {
    return false;
  }

  if (filter.contains !== undefined) {
    if (typeof value !== 'string' || !value.includes(filter.contains)) {
      return false;
    }
  }

  if (filter.startsWith !== undefined) {
    if (typeof value !== 'string' || !value.startsWith(filter.startsWith)) {
      return false;
    }
  }

  if (filter.endsWith !== undefined) {
    if (typeof value !== 'string' || !value.endsWith(filter.endsWith)) {
      return false;
    }
  }

  if (filter.not !== undefined && matchesPrimitiveFilter(value, filter.not)) {
    return false;
  }

  return true;
};

const matchesDateFilter = (value: Date, filter: any): boolean => {
  if (filter === undefined) {
    return true;
  }

  if (!(filter instanceof Object) || filter instanceof Date) {
    return value.getTime() === toDateInstance(filter as Date | string).getTime();
  }

  const timestamp = value.getTime();

  if (
    Object.prototype.hasOwnProperty.call(filter, 'equals') &&
    !matchesDateFilter(value, filter.equals)
  ) {
    return false;
  }

  if (Array.isArray(filter.in)) {
    const matches = filter.in.some((candidate: Date | string) =>
      matchesDateFilter(value, candidate),
    );
    if (!matches) {
      return false;
    }
  }

  if (Array.isArray(filter.notIn)) {
    const matches = filter.notIn.some((candidate: Date | string) =>
      matchesDateFilter(value, candidate),
    );
    if (matches) {
      return false;
    }
  }

  if (filter.lt !== undefined && timestamp >= toDateInstance(filter.lt).getTime()) {
    return false;
  }

  if (filter.lte !== undefined && timestamp > toDateInstance(filter.lte).getTime()) {
    return false;
  }

  if (filter.gt !== undefined && timestamp <= toDateInstance(filter.gt).getTime()) {
    return false;
  }

  if (filter.gte !== undefined && timestamp < toDateInstance(filter.gte).getTime()) {
    return false;
  }

  if (filter.not !== undefined && matchesDateFilter(value, filter.not)) {
    return false;
  }

  return true;
};

const matchesAppointmentWhere = (appointment: AppointmentRecord, where: any = {}): boolean => {
  if (!where) {
    return true;
  }

  if (Array.isArray(where.AND)) {
    if (!where.AND.every((condition: any) => matchesAppointmentWhere(appointment, condition))) {
      return false;
    }
  }

  if (Array.isArray(where.OR)) {
    if (!where.OR.some((condition: any) => matchesAppointmentWhere(appointment, condition))) {
      return false;
    }
  }

  if (Array.isArray(where.NOT)) {
    if (where.NOT.some((condition: any) => matchesAppointmentWhere(appointment, condition))) {
      return false;
    }
  }

  if (!matchesPrimitiveFilter(appointment.id, where.id)) {
    return false;
  }

  if (!matchesPrimitiveFilter(appointment.animalId, where.animalId)) {
    return false;
  }

  if (!matchesPrimitiveFilter(appointment.ownerId, where.ownerId)) {
    return false;
  }

  if (!matchesPrimitiveFilter(appointment.veterinarianId, where.veterinarianId)) {
    return false;
  }

  if (!matchesPrimitiveFilter(appointment.assistantId, where.assistantId)) {
    return false;
  }

  if (!matchesPrimitiveFilter(appointment.serviceId, where.serviceId)) {
    return false;
  }

  if (!matchesPrimitiveFilter(appointment.status, where.status)) {
    return false;
  }

  if (!matchesDateFilter(appointment.scheduledStart, where.scheduledStart)) {
    return false;
  }

  if (!matchesDateFilter(appointment.scheduledEnd, where.scheduledEnd)) {
    return false;
  }

  return true;
};

const sortAppointments = (records: AppointmentRecord[], orderBy: any) => {
  if (!orderBy || typeof orderBy !== 'object') {
    return [...records];
  }

  const entries = Object.entries(orderBy);
  if (entries.length === 0) {
    return [...records];
  }

  const [[field, direction]] = entries;
  const multiplier = direction === 'desc' ? -1 : 1;

  return [...records].sort((a, b) => {
    const aValue = (a as Record<string, any>)[field];
    const bValue = (b as Record<string, any>)[field];

    if (aValue instanceof Date && bValue instanceof Date) {
      return (aValue.getTime() - bValue.getTime()) * multiplier;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue) * multiplier;
    }

    return 0;
  });
};

const baseInvoiceStatuses: InvoiceStatusRecord[] = [
  { id: 'status-aberta', slug: 'ABERTA', name: 'Aberta' },
  { id: 'status-quitada', slug: 'QUITADA', name: 'Quitada' },
];

const prismaMock = createInMemoryPrisma() as InMemoryPrisma & Record<string, any>;
const baseReset = prismaMock.reset.bind(prismaMock);
const baseTransaction = prismaMock.$transaction.bind(prismaMock);

prismaMock.reset = () => {
  baseReset();
  animals.length = 0;
  services.length = 0;
  appointments.length = 0;
  invoices.length = 0;
  invoiceItems.length = 0;
  invoiceInstallments.length = 0;
  paymentConditions.length = 0;
  invoiceStatuses.splice(0, invoiceStatuses.length, ...baseInvoiceStatuses.map((status) => ({ ...status })));
};

prismaMock.$transaction = async (arg: any) => {
  if (typeof arg === 'function') {
    return arg(prismaMock);
  }
  return baseTransaction(arg);
};

const findOwnerById = async (id: string) => prismaMock.owner.findUnique({ where: { id } });

const buildService = async (service: ServiceRecord, include: any) => {
  const result: any = {
    ...service,
    data: new Date(service.data),
    createdAt: new Date(service.createdAt),
    catalogItems: service.catalogItems.map((item) => ({ ...item })),
    items: service.items.map((item) => ({ ...item })),
  };

  if (include?.animal) {
    const animal = animals.find((entry) => entry.id === service.animalId) ?? null;
    if (animal) {
      const animalClone: any = {
        ...animal,
        createdAt: new Date(animal.createdAt),
        nascimento: animal.nascimento ? new Date(animal.nascimento) : null,
      };
      if (include.animal.include?.owner) {
        animalClone.owner = await findOwnerById(animal.ownerId);
      }
      result.animal = animalClone;
    }
  }

  if (include?.invoiceItems) {
    const related = invoiceItems.filter((item) => item.servicoId === service.id);
    result.invoiceItems = await Promise.all(
      related.map(async (item) => {
        const itemClone: any = { ...item };
        if (include.invoiceItems.include?.invoice) {
          const invoice = invoices.find((entry) => entry.id === item.invoiceId) ?? null;
          if (invoice) {
            const invoiceClone: any = { ...invoice };
            if (include.invoiceItems.include.invoice.include?.status) {
              invoiceClone.status = invoiceStatuses.find((status) => status.id === invoice.statusId) ?? null;
            }
            itemClone.invoice = invoiceClone;
          } else {
            itemClone.invoice = null;
          }
        }
        return itemClone;
      }),
    );
  }

  return result;
};

const buildAppointment = async (appointment: AppointmentRecord, include: any) => {
  const result: any = { ...appointment };

  if (include?.animal) {
    const animal = animals.find((entry) => entry.id === appointment.animalId) ?? null;
    if (animal) {
      const animalClone: any = {
        ...animal,
        createdAt: new Date(animal.createdAt),
        nascimento: animal.nascimento ? new Date(animal.nascimento) : null,
      };
      if (include.animal.include?.owner) {
        animalClone.owner = await findOwnerById(animal.ownerId);
      }
      result.animal = animalClone;
    }
  }

  if (include?.owner) {
    result.owner = await findOwnerById(appointment.ownerId);
  }

  if (include?.veterinarian) {
    const vetInclude = include.veterinarian.include ?? {};
    const userInclude: any = {};
    if (vetInclude.role) {
      userInclude.role = {};
    }
    if (vetInclude.collaboratorProfile) {
      userInclude.collaboratorProfile = true;
    }
    result.veterinarian = await prismaMock.user.findUnique({
      where: { id: appointment.veterinarianId },
      include: Object.keys(userInclude).length ? userInclude : undefined,
    });
  }

  if (include?.assistant) {
    if (appointment.assistantId) {
      const assistantInclude = include.assistant.include ?? {};
      const userInclude: any = {};
      if (assistantInclude.role) {
        userInclude.role = {};
      }
      if (assistantInclude.collaboratorProfile) {
        userInclude.collaboratorProfile = true;
      }
      result.assistant = await prismaMock.user.findUnique({
        where: { id: appointment.assistantId },
        include: Object.keys(userInclude).length ? userInclude : undefined,
      });
    } else {
      result.assistant = null;
    }
  }

  if (include?.service) {
    result.service = appointment.serviceId
      ? await prismaMock.servico.findUnique({ where: { id: appointment.serviceId }, include: include.service.include })
      : null;
  }

  return result;
};

const buildInvoice = async (invoice: InvoiceRecord, include: any) => {
  const result: any = {
    ...invoice,
    total: new Decimal(invoice.total),
    dueDate: new Date(invoice.dueDate),
    createdAt: new Date(invoice.createdAt),
    updatedAt: new Date(invoice.updatedAt),
  };

  if (include?.owner) {
    result.owner = await findOwnerById(invoice.ownerId);
  }

  if (include?.status) {
    result.status = invoiceStatuses.find((status) => status.id === invoice.statusId) ?? null;
  }

  if (include?.paymentCondition) {
    result.paymentCondition = invoice.paymentConditionId
      ? paymentConditions.find((condition) => condition.id === invoice.paymentConditionId) ?? null
      : null;
  }

  if (include?.responsible) {
    result.responsible = invoice.responsibleId
      ? await prismaMock.user.findUnique({ where: { id: invoice.responsibleId } })
      : null;
    if (result.responsible && include.responsible.select) {
      const { id, nome, email } = result.responsible;
      result.responsible = { id, nome, email };
    }
  }

  if (include?.items) {
    result.items = await Promise.all(
      invoice.itemIds.map(async (itemId) => {
        const item = invoiceItems.find((entry) => entry.id === itemId);
        if (!item) return null;
        const itemClone: any = { ...item };
        if (include.items.include?.service && item.servicoId) {
          itemClone.service = await prismaMock.servico.findUnique({
            where: { id: item.servicoId },
            include: include.items.include.service.include,
          });
        }
        if (include.items.include?.product && item.productId) {
          itemClone.product = { id: item.productId, nome: 'Produto' };
        }
        return itemClone;
      }),
    ).then((items) => items.filter((item): item is Record<string, unknown> => item !== null));
  }

  if (include?.installments) {
    result.installments = invoiceInstallments
      .filter((installment) => installment.invoiceId === invoice.id)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .map((installment) => ({
        ...installment,
        amount: new Decimal(installment.amount),
        dueDate: new Date(installment.dueDate),
      }));
  }

  return result;
};

(prismaMock as any).animal = {
  async create({ data }: any) {
    const record: AnimalRecord = {
      id: data.id ?? generateId(),
      nome: data.nome,
      especie: data.especie ?? 'CACHORRO',
      ownerId: data.ownerId,
      raca: data.raca ?? null,
      nascimento: data.nascimento ?? null,
      createdAt: data.createdAt ?? new Date(),
    };
    animals.push(record);
    return { ...record };
  },
  async findUnique({ where }: any) {
    const record = animals.find((entry) => entry.id === where.id) ?? null;
    return record ? { ...record } : null;
  },
} as any;

(prismaMock as any).servico = {
  async create({ data }: any) {
    const record: ServiceRecord = {
      id: data.id ?? generateId(),
      animalId: data.animalId,
      tipo: data.tipo ?? 'CONSULTA',
      data: data.data instanceof Date ? data.data : new Date(data.data),
      preco: toDecimal(data.preco ?? 0),
      observacoes: data.observacoes ?? null,
      responsavelId: data.responsavelId ?? null,
      catalogItems: [],
      items: [],
      invoiceItemIds: [],
      createdAt: data.createdAt ?? new Date(),
    };
    services.push(record);
    return { ...record };
  },
  async update({ where, data }: any) {
    const record = services.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Service not found');
    }
    if (data.tipo !== undefined) {
      record.tipo = data.tipo;
    }
    if (data.data !== undefined) {
      record.data = data.data instanceof Date ? data.data : new Date(data.data);
    }
    if (data.preco !== undefined) {
      record.preco = toDecimal(data.preco);
    }
    if (data.observacoes !== undefined) {
      record.observacoes = data.observacoes ?? null;
    }
    if (data.responsavelId !== undefined) {
      record.responsavelId = data.responsavelId ?? null;
    }
    return { ...record };
  },
  async findUnique({ where, include }: any) {
    const record = services.find((entry) => entry.id === where.id);
    if (!record) return null;
    if (!include) return { ...record };
    return buildService(record, include);
  },
} as any;

(prismaMock as any).appointment = {
  async create({ data, include }: any) {
    const record: AppointmentRecord = {
      id: data.id ?? generateId(),
      animalId: data.animalId,
      ownerId: data.ownerId,
      veterinarianId: data.veterinarianId,
      assistantId: data.assistantId ?? null,
      serviceId: data.service?.connect?.id ?? null,
      status: data.status ?? 'AGENDADO',
      scheduledStart: data.scheduledStart instanceof Date ? data.scheduledStart : new Date(data.scheduledStart),
      scheduledEnd: data.scheduledEnd instanceof Date ? data.scheduledEnd : new Date(data.scheduledEnd),
      confirmedAt: data.confirmedAt ?? null,
      completedAt: data.completedAt ?? null,
      notes: data.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    appointments.push(record);
    if (!include) return { ...record };
    return buildAppointment(record, include);
  },
  async findMany({ where, include, orderBy }: any = {}) {
    const filtered = appointments.filter((entry) => matchesAppointmentWhere(entry, where));
    const sorted = sortAppointments(filtered, orderBy);
    if (!include) {
      return sorted.map((entry) => ({ ...entry }));
    }
    return Promise.all(sorted.map((entry) => buildAppointment(entry, include)));
  },
  async findFirst({ where, include, orderBy }: any = {}) {
    const filtered = appointments.filter((entry) => matchesAppointmentWhere(entry, where));
    const [first] = sortAppointments(filtered, orderBy);
    if (!first) {
      return null;
    }
    if (!include) {
      return { ...first };
    }
    return buildAppointment(first, include);
  },
  async findUnique({ where, include }: any) {
    const record = appointments.find((entry) => entry.id === where.id);
    if (!record) return null;
    if (!include) return { ...record };
    return buildAppointment(record, include);
  },
  async update({ where, data, include }: any) {
    const record = appointments.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Appointment not found');
    }
    if (data.animalId !== undefined) {
      record.animalId = data.animalId;
    }
    if (data.ownerId !== undefined) {
      record.ownerId = data.ownerId;
    }
    if (data.veterinarianId !== undefined) {
      record.veterinarianId = data.veterinarianId;
    }
    if (data.assistantId !== undefined) {
      record.assistantId = data.assistantId;
    }
    if (data.status !== undefined) {
      record.status = data.status;
    }
    if (data.confirmedAt !== undefined) {
      record.confirmedAt = data.confirmedAt ?? null;
    }
    if (data.completedAt !== undefined) {
      record.completedAt = data.completedAt ?? null;
    }
    if (data.scheduledStart !== undefined) {
      record.scheduledStart = data.scheduledStart instanceof Date
        ? data.scheduledStart
        : new Date(data.scheduledStart);
    }
    if (data.scheduledEnd !== undefined) {
      record.scheduledEnd = data.scheduledEnd instanceof Date
        ? data.scheduledEnd
        : new Date(data.scheduledEnd);
    }
    if (data.notes !== undefined) {
      record.notes = data.notes ?? null;
    }
    if (data.service?.connect?.id) {
      record.serviceId = data.service.connect.id;
    }
    if (data.service?.disconnect) {
      record.serviceId = null;
    }
    record.updatedAt = new Date();
    if (!include) return { ...record };
    return buildAppointment(record, include);
  },
} as any;

(prismaMock as any).invoiceStatus = {
  async findUnique({ where }: any) {
    if (!where) return null;
    const record = invoiceStatuses.find(
      (entry) => (where.id && entry.id === where.id) || (where.slug && entry.slug === where.slug),
    );
    return record ? { ...record } : null;
  },
} as any;

(prismaMock as any).paymentCondition = {
  async create({ data }: any) {
    const now = new Date();
    const record: PaymentConditionRecord = {
      id: data.id ?? generateId(),
      nome: data.nome,
      prazoDias: data.prazoDias,
      parcelas: data.parcelas ?? 1,
      observacoes: data.observacoes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    paymentConditions.push(record);
    return { ...record };
  },
  async findUnique({ where }: any) {
    if (!where) return null;
    const record = paymentConditions.find((condition) =>
      where.id ? condition.id === where.id : false,
    );
    return record ? { ...record } : null;
  },
  async findMany() {
    return paymentConditions.map((condition) => ({ ...condition }));
  },
} as any;

(prismaMock as any).invoice = {
  async create({ data, include }: any) {
    const now = new Date();
    const record: InvoiceRecord = {
      id: data.id ?? generateId(),
      ownerId: data.ownerId,
      statusId: data.statusId,
      responsibleId: data.responsibleId ?? null,
      paymentMethod: data.paymentMethod ?? null,
      paymentConditionId: data.paymentConditionId ?? null,
      paymentConditionType: data.paymentConditionType ?? null,
      total: toDecimal(data.total),
      dueDate: data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate),
      paidAt: data.paidAt ?? null,
      paymentNotes: data.paymentNotes ?? null,
      createdAt: now,
      updatedAt: now,
      itemIds: [],
    };
    invoices.push(record);

    if (data.items?.create) {
      for (const item of data.items.create) {
        const invoiceItem: InvoiceItemRecord = {
          id: generateId(),
          invoiceId: record.id,
          servicoId: item.servicoId ?? null,
          productId: item.productId ?? null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: toDecimal(item.unitPrice),
          total: toDecimal(item.total),
          createdAt: now,
        };
        invoiceItems.push(invoiceItem);
        record.itemIds.push(invoiceItem.id);
        if (invoiceItem.servicoId) {
          const service = services.find((entry) => entry.id === invoiceItem.servicoId);
          if (service && !service.invoiceItemIds.includes(invoiceItem.id)) {
            service.invoiceItemIds.push(invoiceItem.id);
          }
        }
      }
    }

    if (!include) return { ...record };
    return buildInvoice(record, include);
  },
  async update({ where, data, include }: any) {
    const record = invoices.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Invoice not found');
    }

    if (data.dueDate !== undefined) {
      record.dueDate = data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate);
    }
    if (data.responsibleId !== undefined) {
      record.responsibleId = data.responsibleId ?? null;
    }
    if (data.paymentMethod !== undefined) {
      record.paymentMethod = data.paymentMethod ?? null;
    }
    if (data.paymentConditionId !== undefined) {
      record.paymentConditionId = data.paymentConditionId ?? null;
    }
    if (data.paymentConditionType !== undefined) {
      record.paymentConditionType = data.paymentConditionType ?? null;
    }
    if (data.total !== undefined) {
      record.total = toDecimal(data.total);
    }

    if (data.items?.deleteMany) {
      const filter = data.items.deleteMany;
      const toRemove = invoiceItems.filter(
        (item) =>
          (!filter.invoiceId || item.invoiceId === filter.invoiceId) &&
          (filter.servicoId === undefined || item.servicoId === filter.servicoId),
      );
      for (const item of toRemove) {
        const index = invoiceItems.findIndex((entry) => entry.id === item.id);
        if (index >= 0) {
          invoiceItems.splice(index, 1);
        }
        record.itemIds = record.itemIds.filter((id) => id !== item.id);
        if (item.servicoId) {
          const service = services.find((entry) => entry.id === item.servicoId);
          if (service) {
            service.invoiceItemIds = service.invoiceItemIds.filter((id) => id !== item.id);
          }
        }
      }
    }

    if (data.items?.create) {
      for (const item of data.items.create) {
        const invoiceItem: InvoiceItemRecord = {
          id: generateId(),
          invoiceId: record.id,
          servicoId: item.servicoId ?? null,
          productId: item.productId ?? null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: toDecimal(item.unitPrice),
          total: toDecimal(item.total),
          createdAt: new Date(),
        };
        invoiceItems.push(invoiceItem);
        record.itemIds.push(invoiceItem.id);
        if (invoiceItem.servicoId) {
          const service = services.find((entry) => entry.id === invoiceItem.servicoId);
          if (service && !service.invoiceItemIds.includes(invoiceItem.id)) {
            service.invoiceItemIds.push(invoiceItem.id);
          }
        }
      }
    }

    record.updatedAt = new Date();
    if (!include) return { ...record };
    return buildInvoice(record, include);
  },
  async findUnique({ where, include }: any) {
    const record = invoices.find((entry) => entry.id === where.id);
    if (!record) return null;
    if (!include) return { ...record };
    return buildInvoice(record, include);
  },
} as any;
(prismaMock as any).invoiceItem = {
  async deleteMany({ where }: any) {
    const toRemove = invoiceItems.filter(
      (item) =>
        (!where.invoiceId || item.invoiceId === where.invoiceId) &&
        (where.servicoId === undefined || item.servicoId === where.servicoId),
    );
    for (const item of toRemove) {
      const index = invoiceItems.findIndex((entry) => entry.id === item.id);
      if (index >= 0) {
        invoiceItems.splice(index, 1);
      }
      const invoice = invoices.find((entry) => entry.id === item.invoiceId);
      if (invoice) {
        invoice.itemIds = invoice.itemIds.filter((id) => id !== item.id);
      }
      if (item.servicoId) {
        const service = services.find((entry) => entry.id === item.servicoId);
        if (service) {
          service.invoiceItemIds = service.invoiceItemIds.filter((id) => id !== item.id);
        }
      }
    }
    return { count: toRemove.length };
  },
  async updateMany({ where, data }: any) {
    let count = 0;
    for (const item of invoiceItems) {
      const matches =
        (!where.invoiceId || item.invoiceId === where.invoiceId) &&
        (where.servicoId === undefined || item.servicoId === where.servicoId) &&
        (!where.productId?.in || (item.productId && where.productId.in.includes(item.productId))) &&
        (!where.description?.startsWith || item.description.startsWith(where.description.startsWith));
      if (matches) {
        if (data.servicoId !== undefined) {
          item.servicoId = data.servicoId;
        }
        count += 1;
      }
    }
    return { count };
  },
  async aggregate({ where, _sum }: any) {
    let total = new Decimal(0);
    for (const item of invoiceItems) {
      const matches =
        (!where.invoiceId || item.invoiceId === where.invoiceId) &&
        (where.servicoId === undefined || item.servicoId === where.servicoId);
      if (matches) {
        total = total.add(item.total);
      }
    }
    return { _sum: { total: _sum?.total ? total : null } };
  },
} as any;

  (prismaMock as any).invoiceInstallment = {
    async deleteMany({ where }: any) {
      const toRemove = invoiceInstallments.filter((installment) =>
        where.invoiceId ? installment.invoiceId === where.invoiceId : true,
      );

    for (const installment of toRemove) {
      const index = invoiceInstallments.findIndex((entry) => entry.id === installment.id);
      if (index >= 0) {
        invoiceInstallments.splice(index, 1);
      }
    }
  },
    async createMany({ data }: any) {
      const now = new Date();
      for (const item of data) {
        const record: InvoiceInstallmentRecord = {
          id: generateId(),
        invoiceId: item.invoiceId,
        dueDate: item.dueDate instanceof Date ? item.dueDate : new Date(item.dueDate ?? now),
        amount: toDecimal(item.amount),
        paidAt: item.paidAt ?? null,
      };

        invoiceInstallments.push(record);
      }
    },
    async create({ data }: any) {
      const now = new Date();
      const record: InvoiceInstallmentRecord = {
        id: generateId(),
        invoiceId: data.invoiceId,
        dueDate: data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate ?? now),
        amount: toDecimal(data.amount),
        paidAt: data.paidAt ?? null,
      };

      invoiceInstallments.push(record);
      return { ...record };
    },
    async update({ where, data }: any) {
      const record = invoiceInstallments.find((installment) => installment.id === where.id);
      if (!record) {
        throw new Error('Invoice installment not found');
      }

      if (data.amount !== undefined) {
        record.amount = toDecimal(data.amount);
      }
      if (data.dueDate !== undefined) {
        record.dueDate = data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate);
      }
      if (data.paidAt !== undefined) {
        record.paidAt = data.paidAt ?? null;
      }

      return { ...record };
    },
  async findMany({ where, orderBy }: any = {}) {
    const filtered = invoiceInstallments.filter((installment) =>
      where?.invoiceId ? installment.invoiceId === where.invoiceId : true,
    );

    const sorted = orderBy?.dueDate === 'asc'
      ? [...filtered].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      : [...filtered];

    return sorted.map((installment) => ({
      ...installment,
      amount: new Decimal(installment.amount),
      dueDate: new Date(installment.dueDate),
    }));
  },
} as any;

prismaMock.reset();

process.env.DATABASE_URL ??= 'file:memory:?schema=public';
process.env.JWT_SECRET ??= 'test-secret';
process.env.JWT_EXPIRES_IN ??= '15m';
process.env.PASSWORD_SALT_ROUNDS ??= '12';
process.env.AUTH_RATE_LIMIT_WINDOW_MS ??= '60000';
process.env.AUTH_RATE_LIMIT_MAX ??= '10';

const prisma = prismaMock as InMemoryPrisma;

let app: typeof import('../src/app.js')['app'];
let server: Server;
let baseUrl: string;
let hashPassword: typeof import('../src/utils/auth.js')['hashPassword'];
let syncInvoiceForService: typeof import('../src/utils/invoice.js')['syncInvoiceForService'];

const startServer = async () => {
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (address && typeof address === 'object') {
    baseUrl = `http://127.0.0.1:${address.port}`;
    return;
  }
  throw new Error('Não foi possível iniciar o servidor de testes.');
};

const stopServer = async () =>
  new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const get = async (path: string, token?: string) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await response.json() : null;
  return { response, data } as const;
};

const post = async (path: string, body: unknown, token?: string) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await response.json() : null;
  return { response, data } as const;
};

const patch = async (path: string, body: unknown, token?: string) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await response.json() : null;
  return { response, data } as const;
};
let adminId: string;
let veterinarianId: string;

const seedAdminUser = async () => {
  const passwordHash = await hashPassword('Admin123!');
  const adminRole = await prisma.role.findUnique({ where: { slug: 'ADMINISTRADOR' } });
  assert.ok(adminRole);
  const admin = await prisma.user.create({
    data: {
      nome: 'Admin Auravet',
      email: 'admin@auravet.com',
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });
  adminId = admin.id;
};

const seedVeterinarianUser = async () => {
  const passwordHash = await hashPassword('VetAurora123!');
  const doctorRole = await prisma.role.findUnique({ where: { slug: 'MEDICO' } });
  assert.ok(doctorRole);
  const vet = await prisma.user.create({
    data: {
      nome: 'Dra. Teste',
      email: 'vet@auravet.com',
      passwordHash,
      roleId: doctorRole.id,
      isActive: true,
    },
  });
  veterinarianId = vet.id;
};

before(async () => {
  globalThis.__PRISMA__ = prismaMock;
  const appModuleUrl = new URL('../src/app.js', `file://${__filename}`);
  appModuleUrl.search = `?appointments-test=${Date.now()}`;
  const [{ app: importedApp }, authModule, invoiceModule] = await Promise.all([
    import(appModuleUrl.href),
    import('../src/utils/auth.js'),
    import('../src/utils/invoice.js'),
  ]);

  app = importedApp;
  hashPassword = authModule.hashPassword;
  syncInvoiceForService = invoiceModule.syncInvoiceForService;

  await startServer();
});

after(async () => {
  await stopServer();
});

beforeEach(async () => {
  prisma.reset();
  await seedAdminUser();
  await seedVeterinarianUser();
});

describe('appointmentUpdateSchema', () => {
  it('retains null assistantId values to allow disconnection', () => {
    const payload = appointmentUpdateSchema.parse({ assistantId: null });

    assert.ok(Object.prototype.hasOwnProperty.call(payload, 'assistantId'));
    assert.equal(payload.assistantId, null);
  });
});

describe('GET /appointments/billable', () => {
  it('returns only concluded appointments eligible for billing', async () => {
    const login = await post('/auth/login', {
      email: 'admin@auravet.com',
      password: 'Admin123!',
    });

    assert.equal(login.response.status, 200);
    const token = login.data?.token as string;
    assert.ok(token);

    const owner = await prisma.owner.create({
      data: {
        nome: 'Cliente Faturamento',
        email: 'faturamento@example.com',
      },
    });

    const animal = await prismaMock.animal.create({
      data: {
        nome: 'Thor',
        especie: 'CACHORRO',
        ownerId: owner.id,
      },
    });

    const concludedService = await prismaMock.servico.create({
      data: {
        animalId: animal.id,
        tipo: 'CONSULTA',
        data: new Date('2024-02-01T12:00:00.000Z'),
        preco: 200,
      },
    });

    const confirmedService = await prismaMock.servico.create({
      data: {
        animalId: animal.id,
        tipo: 'CONSULTA',
        data: new Date('2024-02-02T12:00:00.000Z'),
        preco: 200,
      },
    });

    const concludedAppointment = await (prismaMock.appointment as any).create({
      data: {
        animalId: animal.id,
        ownerId: owner.id,
        veterinarianId,
        status: 'CONCLUIDO',
        scheduledStart: new Date('2024-02-01T12:00:00.000Z'),
        scheduledEnd: new Date('2024-02-01T12:30:00.000Z'),
        service: { connect: { id: concludedService.id } },
      },
    });

    await (prismaMock.appointment as any).create({
      data: {
        animalId: animal.id,
        ownerId: owner.id,
        veterinarianId,
        status: 'CONFIRMADO',
        scheduledStart: new Date('2024-02-02T12:00:00.000Z'),
        scheduledEnd: new Date('2024-02-02T12:30:00.000Z'),
        service: { connect: { id: confirmedService.id } },
      },
    });

    const billable = await get('/appointments/billable', token);

    assert.equal(billable.response.status, 200);
    assert.ok(Array.isArray(billable.data));
    assert.deepEqual(
      (billable.data as Array<{ id: string }>).map((appointment) => appointment.id),
      [concludedAppointment.id],
    );
  });
});

describe('PATCH /appointments/:id/complete', () => {
  it('updates invoices when completing an appointment with an existing service invoice', async () => {
    const login = await post('/auth/login', {
      email: 'admin@auravet.com',
      password: 'Admin123!',
    });

    assert.equal(login.response.status, 200);
    const token = login.data?.token as string;
    assert.ok(token);

    const owner = await prisma.owner.create({
      data: {
        nome: 'Bruno Tutor',
        email: 'bruno.tutor@example.com',
      },
    });

    const animal = await prismaMock.animal.create({
      data: {
        nome: 'Luna',
        especie: 'CACHORRO',
        ownerId: owner.id,
      },
    });

    const service = await prismaMock.servico.create({
      data: {
        animalId: animal.id,
        tipo: 'CONSULTA',
        data: new Date('2024-01-01T13:00:00.000Z'),
        preco: 150,
      },
    });

    const appointment = await (prismaMock.appointment as any).create({
      data: {
        animalId: animal.id,
        ownerId: owner.id,
        veterinarianId,
        status: 'AGENDADO',
        scheduledStart: new Date('2024-01-02T13:00:00.000Z'),
        scheduledEnd: new Date('2024-01-02T13:30:00.000Z'),
        service: { connect: { id: service.id } },
      },
    });

    await prisma.$transaction((tx) => syncInvoiceForService(tx, service.id, { responsibleId: adminId }));

    const updatedPrice = 275;

    const completion = await patch(
      `/appointments/${appointment.id}/complete`,
      { service: { preco: updatedPrice } },
      token,
    );

    assert.equal(completion.response.status, 200);
    assert.equal(completion.data?.appointment?.status, 'CONCLUIDO');
    assert.equal(completion.data?.appointment?.service?.preco, updatedPrice);

    const invoiceItem = invoiceItems.find((item) => item.servicoId === service.id);
    assert.ok(invoiceItem);
    const invoice = invoices.find((entry) => entry.id === invoiceItem.invoiceId);
    assert.ok(invoice);
    assert.equal(Number(invoice.total), updatedPrice);
  });
});

describe('POST /invoices', () => {
  it('rejects invoicing confirmed appointments', async () => {
    const login = await post('/auth/login', {
      email: 'admin@auravet.com',
      password: 'Admin123!',
    });

    assert.equal(login.response.status, 200);
    const token = login.data?.token as string;
    assert.ok(token);

    const owner = await prisma.owner.create({
      data: {
        nome: 'Cliente Confirmado',
        email: 'confirmado@example.com',
      },
    });

    const animal = await prismaMock.animal.create({
      data: {
        nome: 'Mia',
        especie: 'GATO',
        ownerId: owner.id,
      },
    });

    const service = await prismaMock.servico.create({
      data: {
        animalId: animal.id,
        tipo: 'CONSULTA',
        data: new Date('2024-03-01T15:00:00.000Z'),
        preco: 180,
      },
    });

    const appointment = await (prismaMock.appointment as any).create({
      data: {
        animalId: animal.id,
        ownerId: owner.id,
        veterinarianId,
        status: 'CONFIRMADO',
        scheduledStart: new Date('2024-03-01T15:00:00.000Z'),
        scheduledEnd: new Date('2024-03-01T15:45:00.000Z'),
        service: { connect: { id: service.id } },
      },
    });

    const invoice = await post(
      '/invoices',
      {
        appointmentId: appointment.id,
      },
      token,
    );

    assert.equal(invoice.response.status, 400);
    assert.equal(invoice.data?.message, 'Apenas agendamentos concluídos podem ser faturados.');
  });
});

describe('PATCH /invoices/:id/adjust', () => {
  it('synchronizes paymentConditionType with the selected paymentConditionId', async () => {
    const login = await post('/auth/login', {
      email: 'admin@auravet.com',
      password: 'Admin123!',
    });

    assert.equal(login.response.status, 200);
    const token = login.data?.token as string;
    assert.ok(token);

    const owner = await prisma.owner.create({
      data: {
        nome: 'Marina Duarte',
        email: 'marina.duarte@example.com',
      },
    });

    const conditionId = generateId();

    const condition = await prisma.paymentCondition.create({
      data: {
        id: conditionId,
        nome: '60 dias',
        prazoDias: 60,
        parcelas: 1,
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        ownerId: owner.id,
        statusId: baseInvoiceStatuses[0].id,
        total: new Prisma.Decimal(100),
        dueDate: new Date('2024-01-10T00:00:00.000Z'),
        paymentConditionType: PaymentConditionType.A_VISTA,
      },
    });

    const payload = {
      dueDate: '2024-02-10',
      paymentConditionId: condition.id,
      installments: [
        {
          dueDate: '2024-02-10',
          amount: 100,
        },
      ],
    };

    const adjustment = await patch(`/invoices/${invoice.id}/adjust`, payload, token);

    assert.equal(adjustment.response.status, 200);
    assert.equal(adjustment.data?.paymentConditionId, condition.id);
    assert.equal(adjustment.data?.paymentCondition, null);
    assert.equal(adjustment.data?.paymentConditionDetails?.id, condition.id);
  });
});
