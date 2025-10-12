import type {
  Animal,
  Appointment,
  CollaboratorProfile,
  Module,
  Owner,
  Prisma,
  Product,
  Role,
  ServiceProductUsage,
  Servico,
  User,
} from '@prisma/client';

import type { UserWithRole } from './auth';
import { buildAuthenticatedUser } from './auth';

type ServiceItemWithProduct = ServiceProductUsage & { product: Product };

type InvoiceItemWithRelations = Prisma.InvoiceItemGetPayload<{
  include: {
    product: { select: { id: true; nome: true } };
    service: {
      include: {
        animal: {
          include: {
            owner: true;
          };
        };
      };
    };
  };
}>;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    owner: true;
    status: true;
    responsible: { select: { id: true; nome: true; email: true } };
    items: {
      include: {
        product: { select: { id: true; nome: true } };
        service: {
          include: {
            animal: {
              include: {
                owner: true;
              };
            };
          };
        };
      };
    };
  };
}>;

type ServiceWithOptionalRelations = Servico & {
  animal?: AnimalWithOptionalRelations | null;
  items?: ServiceItemWithProduct[];
  appointment?: Appointment | null;
};

type AnimalWithOptionalRelations = Animal & {
  owner?: Owner | null;
  services?: ServiceWithOptionalRelations[];
  appointments?: AppointmentWithRelations[];
};

type OwnerWithOptionalRelations = Owner & {
  animals?: AnimalWithOptionalRelations[];
  appointments?: AppointmentWithRelations[];
};

export type SerializedServiceItem = {
  id: string;
  productId: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  product: {
    id: string;
    nome: string;
    precoVenda: number;
    estoqueAtual: number;
    estoqueMinimo: number;
  };
};

export type SerializedInvoiceItem = {
  id: string;
  invoiceId: string;
  servicoId: string | null;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  product: { id: string; nome: string } | null;
  service: {
    id: string;
    tipo: Servico['tipo'];
    data: string;
    animal?: {
      id: string;
      nome: string;
      owner?: { id: string; nome: string };
    };
  } | null;
};

export type SerializedInvoice = {
  id: string;
  ownerId: string;
  status: { id: string; slug: string; name: string };
  total: number;
  dueDate: string;
  paidAt: string | null;
  paymentNotes: string | null;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    nome: string;
    email: string;
    telefone: string | null;
  };
  responsible: { id: string; nome: string; email: string } | null;
  items: SerializedInvoiceItem[];
};

export type SerializedService = {
  id: string;
  animalId: string;
  tipo: Servico['tipo'];
  data: string;
  preco: number;
  observacoes: string | null;
  createdAt: string;
  appointmentId: string | null;
  animal?: SerializedAnimal;
  items: SerializedServiceItem[];
};

export type SerializedAnimal = {
  id: string;
  nome: string;
  especie: Animal['especie'];
  raca: string | null;
  nascimento: string | null;
  ownerId: string;
  createdAt: string;
  owner?: SerializedOwner;
  services?: SerializedService[];
};

export type SerializedOwner = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  createdAt: string;
  animals?: SerializedAnimal[];
};

export type SerializedModule = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SerializedRoleModule = SerializedModule & {
  isEnabled: boolean;
};

export type RoleWithModules = Prisma.RoleGetPayload<{
  include: {
    modules: {
      include: {
        module: true;
      };
    };
  };
}>;

export type SerializedRole = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  modules: SerializedRoleModule[];
  createdAt: string;
  updatedAt: string;
};

export type SerializedUser = {
  id: string;
  nome: string;
  email: string;
  role: {
    id: string;
    slug: string;
    name: string;
  };
  isActive: boolean;
  lastLoginAt: string | null;
  modules: string[];
  createdAt: string;
  updatedAt: string;
  collaboratorProfile: SerializedCollaboratorProfile | null;
};

export type SerializedCollaboratorProfile = {
  especialidade: string | null;
  crmv: string | null;
  turnos: string[];
  bio: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedAppointmentUser = {
  id: string;
  nome: string;
  email: string;
  role: {
    id: string;
    slug: string;
    name: string;
  };
  collaboratorProfile: SerializedCollaboratorProfile | null;
};

type AppointmentWithRelations = Appointment & {
  animal: Animal & { owner: Owner };
  owner: Owner;
  veterinarian: User & { role: Role; collaboratorProfile?: CollaboratorProfile | null };
  assistant?: (User & { role: Role; collaboratorProfile?: CollaboratorProfile | null }) | null;
  service?: Servico | null;
};

export type AppointmentAvailability = {
  veterinarianConflict: boolean;
  assistantConflict: boolean;
};

export type SerializedAppointment = {
  id: string;
  animalId: string;
  ownerId: string;
  veterinarianId: string;
  assistantId: string | null;
  serviceId: string | null;
  status: Appointment['status'];
  scheduledStart: string;
  scheduledEnd: string;
  confirmedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  durationMinutes: number;
  availability: {
    veterinarianConflict: boolean;
    assistantConflict: boolean;
  };
  animal: SerializedAnimal;
  owner: SerializedOwner;
  veterinarian: SerializedAppointmentUser;
  assistant: SerializedAppointmentUser | null;
  service: SerializedService | null;
};

const serializeCollaboratorProfile = (
  profile: CollaboratorProfile,
): SerializedCollaboratorProfile => ({
  especialidade: profile.especialidade ?? null,
  crmv: profile.crmv ?? null,
  turnos: profile.turnos ?? [],
  bio: profile.bio ?? null,
  createdAt: profile.createdAt.toISOString(),
  updatedAt: profile.updatedAt.toISOString(),
});

export const serializeAppointmentUser = (
  user: User & { role: Role; collaboratorProfile?: CollaboratorProfile | null },
): SerializedAppointmentUser => ({
  id: user.id,
  nome: user.nome,
  email: user.email,
  role: {
    id: user.role.id,
    slug: user.role.slug,
    name: user.role.name,
  },
  collaboratorProfile: user.collaboratorProfile ? serializeCollaboratorProfile(user.collaboratorProfile) : null,
});

export const serializeAppointment = (
  appointment: AppointmentWithRelations,
  availability: AppointmentAvailability,
): SerializedAppointment => ({
  id: appointment.id,
  animalId: appointment.animalId,
  ownerId: appointment.ownerId,
  veterinarianId: appointment.veterinarianId,
  assistantId: appointment.assistantId ?? null,
  serviceId: appointment.serviceId ?? null,
  status: appointment.status,
  scheduledStart: appointment.scheduledStart.toISOString(),
  scheduledEnd: appointment.scheduledEnd.toISOString(),
  confirmedAt: appointment.confirmedAt ? appointment.confirmedAt.toISOString() : null,
  completedAt: appointment.completedAt ? appointment.completedAt.toISOString() : null,
  notes: appointment.notes ?? null,
  createdAt: appointment.createdAt.toISOString(),
  updatedAt: appointment.updatedAt.toISOString(),
  durationMinutes: Math.max(
    0,
    Math.round((appointment.scheduledEnd.getTime() - appointment.scheduledStart.getTime()) / (1000 * 60)),
  ),
  availability,
  animal: serializeAnimal({ ...appointment.animal, services: undefined, appointments: undefined }),
  owner: serializeOwner({ ...appointment.owner, animals: undefined, appointments: undefined }),
  veterinarian: serializeAppointmentUser(appointment.veterinarian),
  assistant: appointment.assistant ? serializeAppointmentUser(appointment.assistant) : null,
  service: appointment.service
    ? serializeService({ ...appointment.service, animal: undefined, items: undefined, appointment: undefined })
    : null,
});

export type SerializedProduct = {
  id: string;
  nome: string;
  descricao: string | null;
  custo: number;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  isActive: boolean;
  isSellable: boolean;
  createdAt: string;
  updatedAt: string;
};

export const serializeService = (
  service: ServiceWithOptionalRelations,
  options?: { includeAnimal?: boolean },
): SerializedService => {
  const serialized: SerializedService = {
    id: service.id,
    animalId: service.animalId,
    tipo: service.tipo,
    data: service.data.toISOString(),
    preco: Number(service.preco),
    observacoes: service.observacoes ?? null,
    createdAt: service.createdAt.toISOString(),
    appointmentId: service.appointment?.id ?? null,
    items:
      service.items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantidade: item.quantidade,
        valorUnitario: Number(item.valorUnitario),
        valorTotal: Number(item.valorTotal),
        product: {
          id: item.product.id,
          nome: item.product.nome,
          precoVenda: Number(item.product.precoVenda),
          estoqueAtual: item.product.estoqueAtual,
          estoqueMinimo: item.product.estoqueMinimo,
        },
      })) ?? [],
  };

  if (options?.includeAnimal && service.animal) {
    serialized.animal = serializeAnimal(service.animal);
  }

  return serialized;
};

export const serializeAnimal = (animal: AnimalWithOptionalRelations): SerializedAnimal => ({
  id: animal.id,
  nome: animal.nome,
  especie: animal.especie,
  raca: animal.raca ?? null,
  nascimento: animal.nascimento ? animal.nascimento.toISOString() : null,
  ownerId: animal.ownerId,
  createdAt: animal.createdAt.toISOString(),
  owner: animal.owner
    ? {
        id: animal.owner.id,
        nome: animal.owner.nome,
        email: animal.owner.email,
        telefone: animal.owner.telefone ?? null,
        createdAt: animal.owner.createdAt.toISOString(),
      }
    : undefined,
  services: animal.services?.map((service) => serializeService(service)),
});

export const serializeOwner = (owner: OwnerWithOptionalRelations): SerializedOwner => ({
  id: owner.id,
  nome: owner.nome,
  email: owner.email,
  telefone: owner.telefone ?? null,
  createdAt: owner.createdAt.toISOString(),
  animals: owner.animals?.map((animal) =>
    serializeAnimal({
      ...animal,
      owner: undefined,
      services: animal.services?.map((service) => ({ ...service, animal: undefined })),
    }),
  ),
});

export const serializeModule = (module: Module): SerializedModule => ({
  id: module.id,
  slug: module.slug,
  name: module.name,
  description: module.description ?? null,
  isActive: module.isActive,
  createdAt: module.createdAt.toISOString(),
  updatedAt: module.updatedAt.toISOString(),
});

export const serializeRole = (role: RoleWithModules): SerializedRole => ({
  id: role.id,
  name: role.name,
  slug: role.slug,
  description: role.description ?? null,
  isActive: role.isActive,
  modules: role.modules
    .slice()
    .sort((a, b) => a.module.name.localeCompare(b.module.name))
    .map((access) => ({
      ...serializeModule(access.module),
      isEnabled: access.isEnabled,
    })),
  createdAt: role.createdAt.toISOString(),
  updatedAt: role.updatedAt.toISOString(),
});

export const serializeUser = (user: UserWithRole): SerializedUser => {
  const authenticated = buildAuthenticatedUser(user);

  return {
    id: authenticated.id,
    nome: authenticated.nome,
    email: authenticated.email,
    role: authenticated.role,
    isActive: authenticated.isActive,
    lastLoginAt: authenticated.lastLoginAt ? authenticated.lastLoginAt.toISOString() : null,
    modules: authenticated.modules,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    collaboratorProfile: user.collaboratorProfile ? serializeCollaboratorProfile(user.collaboratorProfile) : null,
  };
};

export const serializeProduct = (product: Product): SerializedProduct => ({
  id: product.id,
  nome: product.nome,
  descricao: product.descricao ?? null,
  custo: Number(product.custo),
  precoVenda: Number(product.precoVenda),
  estoqueAtual: product.estoqueAtual,
  estoqueMinimo: product.estoqueMinimo,
  isActive: product.isActive,
  isSellable: product.isSellable,
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt.toISOString(),
});

const serializeInvoiceItemService = (service: InvoiceItemWithRelations['service']): SerializedInvoiceItem['service'] => {
  if (!service) {
    return null;
  }

  return {
    id: service.id,
    tipo: service.tipo,
    data: service.data.toISOString(),
    animal: service.animal
      ? {
          id: service.animal.id,
          nome: service.animal.nome,
          owner: service.animal.owner
            ? {
                id: service.animal.owner.id,
                nome: service.animal.owner.nome,
              }
            : undefined,
        }
      : undefined,
  };
};

export const serializeInvoiceItem = (item: InvoiceItemWithRelations): SerializedInvoiceItem => ({
  id: item.id,
  invoiceId: item.invoiceId,
  servicoId: item.servicoId ?? null,
  productId: item.productId ?? null,
  description: item.description,
  quantity: item.quantity,
  unitPrice: Number(item.unitPrice),
  total: Number(item.total),
  createdAt: item.createdAt.toISOString(),
  product: item.product ? { id: item.product.id, nome: item.product.nome } : null,
  service: serializeInvoiceItemService(item.service),
});

export const serializeInvoice = (invoice: InvoiceWithRelations): SerializedInvoice => ({
  id: invoice.id,
  ownerId: invoice.ownerId,
  status: {
    id: invoice.status.id,
    slug: invoice.status.slug,
    name: invoice.status.name,
  },
  total: Number(invoice.total),
  dueDate: invoice.dueDate.toISOString(),
  paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
  paymentNotes: invoice.paymentNotes ?? null,
  createdAt: invoice.createdAt.toISOString(),
  updatedAt: invoice.updatedAt.toISOString(),
  owner: {
    id: invoice.owner.id,
    nome: invoice.owner.nome,
    email: invoice.owner.email,
    telefone: invoice.owner.telefone ?? null,
  },
  responsible: invoice.responsible
    ? { id: invoice.responsible.id, nome: invoice.responsible.nome, email: invoice.responsible.email }
    : null,
  items: invoice.items.map((item) => serializeInvoiceItem(item)),
});
