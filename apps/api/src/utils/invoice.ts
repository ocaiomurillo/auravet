import { Prisma, PrismaClient } from '@prisma/client';

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
            },
          },
        },
      },
    },
  });

  if (!service) {
    throw new HttpError(404, 'Serviço não encontrado para geração da conta.');
  }

  return service;
};

const buildInvoiceItemsData = (service: ServiceForInvoice) => {
  const serviceItems = service.catalogItems.length
    ? service.catalogItems.map((item) => ({
        servicoId: service.id,
        description: item.definition ? `Serviço: ${item.definition.nome}` : 'Serviço prestado',
        quantity: item.quantidade,
        unitPrice: item.valorUnitario,
        total: item.valorTotal,
      }))
    : [
        {
          servicoId: service.id,
          description: `Serviço: ${service.tipo}`,
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
      throw new HttpError(404, 'Conta vinculada ao serviço não foi encontrada.');
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

    const updated = await tx.invoice.update({
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

    return updated;
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

  return created;
};

export const fetchInvoiceCandidates = async (
  tx: Prisma.TransactionClient | PrismaClient,
  ownerId?: string,
) => {
  const services = await tx.servico.findMany({
    where: {
      invoiceItems: { none: {} },
      animal: ownerId ? { ownerId } : undefined,
    },
    include: {
      animal: { include: { owner: true } },
      items: { include: { product: true } },
      catalogItems: { include: { definition: true } },
    },
    orderBy: { data: 'desc' },
  });

  return services.map((service) => serializeService(service, { includeAnimal: true }));
};

export const getPaidStatus = async (tx: Prisma.TransactionClient) => ensureInvoiceStatus(tx, PAID_STATUS_SLUG);
