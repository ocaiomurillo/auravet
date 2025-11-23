import { AppointmentStatus, Prisma, PrismaClient } from '@prisma/client';

import { HttpError } from './http-error';
import { serializeService } from './serializers';

const OPEN_STATUS_SLUG = 'ABERTA';
const PAID_STATUS_SLUG = 'QUITADA';

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const invoiceInclude = {
  owner: true,
  status: true,
  responsible: {
    select: {
      id: true,
      nome: true,
      email: true,
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          nome: true,
        },
      },
      service: {
        include: {
          animal: {
            include: {
              owner: true,
            },
          },
        },
      },
    },
  },
  installments: {
    orderBy: { dueDate: 'asc' },
  },
} as const;

export type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

type ServiceForInvoice = Prisma.ServicoGetPayload<{
  include: {
    animal: { include: { owner: true } };
    items: { include: { product: true } };
    catalogItems: { include: { definition: true } };
    invoiceItems: {
      include: {
        invoice: {
          include: {
            status: true;
            installments: true;
          };
        };
      };
    };
  };
}>;

const ensureInvoiceStatus = async (tx: Prisma.TransactionClient, slug: string) => {
  const status = await tx.invoiceStatus.findUnique({ where: { slug } });
  if (!status) {
    throw new HttpError(500, `Status de fatura ${slug} não encontrado. Execute as seeds novamente.`);
  }
  return status;
};

const loadServiceForInvoice = async (
  tx: Prisma.TransactionClient,
  serviceId: string,
): Promise<ServiceForInvoice> => {
  const service = await tx.servico.findUnique({
    where: { id: serviceId },
    include: {
      animal: { include: { owner: true } },
      items: { include: { product: true } },
      catalogItems: { include: { definition: true } },
      invoiceItems: {
        include: {
          invoice: {
            include: {
              status: true,
              installments: true,
            },
          },
        },
      },
    },
  });

  if (!service) {
    throw new HttpError(404, 'Atendimento não encontrado para geração da conta.');
  }

  return service;
};

const buildInvoiceItemsData = (service: ServiceForInvoice) => {
  const serviceItems = service.catalogItems.length
    ? service.catalogItems.map((item) => ({
        servicoId: service.id,
        description: item.definition ? `Serviço do catálogo: ${item.definition.nome}` : 'Atendimento prestado',
        quantity: item.quantidade,
        unitPrice: item.valorUnitario,
        total: item.valorTotal,
      }))
    : [
        {
          servicoId: service.id,
          description: `Atendimento: ${service.tipo}`,
          quantity: 1,
          unitPrice: service.preco,
          total: service.preco,
        },
      ];

  const productItems = service.items.map((item) => ({
    servicoId: service.id,
    productId: item.productId,
    description: item.product ? `Produto: ${item.product.nome}` : 'Produto utilizado',
    quantity: item.quantidade,
    unitPrice: item.valorUnitario,
    total: item.valorTotal,
  }));

  return { serviceItems, productItems };
};

const calculateInvoiceTotal = (service: ServiceForInvoice) => {
  const servicesTotal = service.catalogItems.length
    ? service.catalogItems.reduce(
        (acc, item) => acc.add(item.valorTotal),
        new Prisma.Decimal(0),
      )
    : service.preco;
  const productsTotal = service.items.reduce(
    (acc, item) => acc.add(item.valorTotal),
    new Prisma.Decimal(0),
  );
  return servicesTotal.add(productsTotal);
};

const ZERO_DECIMAL = new Prisma.Decimal(0);

export const reconcileInstallmentsForInvoice = async (
  tx: Prisma.TransactionClient,
  invoiceId: string,
  total: Prisma.Decimal,
  fallbackDueDate: Date,
) => {
  const installments = await tx.invoiceInstallment.findMany({
    where: { invoiceId },
    orderBy: { dueDate: 'asc' },
  });

  if (!installments.length) {
    await tx.invoiceInstallment.create({
      data: {
        invoiceId,
        amount: total,
        dueDate: fallbackDueDate,
      },
    });
    return fallbackDueDate;
  }

  const sum = installments.reduce((acc, installment) => acc.add(installment.amount), ZERO_DECIMAL);
  const difference = total.sub(sum);

  if (!difference.equals(ZERO_DECIMAL)) {
    const lastInstallment = installments[installments.length - 1];
    await tx.invoiceInstallment.update({
      where: { id: lastInstallment.id },
      data: { amount: lastInstallment.amount.add(difference) },
    });
  }

  return installments[0].dueDate;
};

export interface SyncInvoiceOptions {
  dueDate?: Date;
  responsibleId?: string | null;
}

export const syncInvoiceForService = async (
  tx: Prisma.TransactionClient,
  serviceId: string,
  { dueDate, responsibleId }: SyncInvoiceOptions = {},
): Promise<InvoiceWithRelations> => {
  const service = await loadServiceForInvoice(tx, serviceId);
  const existingInvoiceItem = service.invoiceItems[0];
  const existingInvoice = existingInvoiceItem?.invoice ?? null;

  if (existingInvoice && existingInvoice.status.slug === PAID_STATUS_SLUG) {
    const invoice = await tx.invoice.findUnique({
      where: { id: existingInvoice.id },
      include: invoiceInclude,
    });
    if (!invoice) {
      throw new HttpError(404, 'Conta vinculada ao atendimento não foi encontrada.');
    }
    return invoice;
  }

  const { serviceItems, productItems } = buildInvoiceItemsData(service);
  const serviceTotal = calculateInvoiceTotal(service);

  const resolvedDueDate = dueDate ?? existingInvoice?.dueDate ?? addDays(new Date(service.data), 7);
  const resolvedResponsible = responsibleId ?? existingInvoice?.responsibleId ?? null;

  if (existingInvoice) {
    const productIds = service.items.map((item) => item.productId);

    if (productIds.length > 0) {
      await tx.invoiceItem.updateMany({
        where: {
          invoiceId: existingInvoice.id,
          servicoId: null,
          productId: { in: productIds },
          description: { startsWith: 'Produto: ' },
        },
        data: { servicoId: service.id },
      });
    }

    const manualItemsTotalResult = await tx.invoiceItem.aggregate({
      where: { invoiceId: existingInvoice.id, servicoId: null },
      _sum: { total: true },
    });
    const manualItemsTotal = manualItemsTotalResult._sum.total ?? new Prisma.Decimal(0);
    const total = serviceTotal.add(manualItemsTotal);

    await tx.invoice.update({
      where: { id: existingInvoice.id },
      data: {
        dueDate: resolvedDueDate,
        responsibleId: resolvedResponsible,
        total,
        items: {
          deleteMany: { invoiceId: existingInvoice.id, servicoId: service.id },
          create: [...serviceItems, ...productItems],
        },
      },
      include: invoiceInclude,
    });

    await reconcileInstallmentsForInvoice(tx, existingInvoice.id, total, resolvedDueDate);

    const refreshed = await tx.invoice.findUnique({ where: { id: existingInvoice.id }, include: invoiceInclude });
    if (!refreshed) {
      throw new HttpError(404, 'Conta vinculada ao atendimento não foi encontrada.');
    }

    return refreshed;
  }

  const openStatus = await ensureInvoiceStatus(tx, OPEN_STATUS_SLUG);

  const created = await tx.invoice.create({
    data: {
      ownerId: service.animal.ownerId,
      statusId: openStatus.id,
      responsibleId: resolvedResponsible,
      dueDate: resolvedDueDate,
      total: serviceTotal,
      items: {
        create: [...serviceItems, ...productItems],
      },
    },
    include: invoiceInclude,
  });

  await reconcileInstallmentsForInvoice(tx, created.id, serviceTotal, resolvedDueDate);

  const refreshed = await tx.invoice.findUnique({ where: { id: created.id }, include: invoiceInclude });
  if (!refreshed) {
    throw new HttpError(404, 'Conta vinculada ao atendimento não foi encontrada.');
  }

  return refreshed;
};

export const fetchInvoiceCandidates = async (
  tx: Prisma.TransactionClient | PrismaClient,
  ownerId?: string,
) => {
  const appointments = await tx.appointment.findMany({
    where: {
      status: AppointmentStatus.CONCLUIDO,
      serviceId: { not: null },
      service: { invoiceItems: { none: {} } },
      ownerId: ownerId ?? undefined,
    },
    include: {
      service: {
        include: {
          animal: { include: { owner: true } },
          items: { include: { product: true } },
          catalogItems: { include: { definition: true } },
          appointment: true,
        },
      },
    },
    orderBy: { scheduledStart: 'desc' },
  });

  const services = appointments.flatMap((appointment) => (appointment.service ? [appointment.service] : []));

  return services.map((service) => serializeService(service, { includeAnimal: true }));
};

export const getOpenStatus = async (tx: Prisma.TransactionClient) => ensureInvoiceStatus(tx, OPEN_STATUS_SLUG);
export const getPaidStatus = async (tx: Prisma.TransactionClient) => ensureInvoiceStatus(tx, PAID_STATUS_SLUG);
