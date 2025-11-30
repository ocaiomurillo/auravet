import { AppointmentStatus, Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/async-handler';
import { hasModule } from '../utils/permissions';

interface DashboardSummary {
  services?: {
    total: number;
    ongoing: number;
    completed: number;
  };
  appointments?: {
    scheduled: number;
    confirmed: number;
    completed: number;
    today: number;
    upcomingWeek: number;
  };
  products?: {
    critical: number;
    lowStock: number;
    totalActive: number;
  };
  invoices?: {
    blocked: number;
    open: number;
    partiallyPaid: number;
    paid: number;
    receivableTotal: number;
    overdueTotal: number;
    receivedTotal: number;
  };
  owners?: {
    total: number;
  };
  animals?: {
    total: number;
  };
}

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const modules = req.user?.modules ?? [];
    const summary: DashboardSummary = {};
    const jobs: Array<Promise<void>> = [];

    if (hasModule(modules, 'services:read')) {
      jobs.push(
        (async () => {
          const [total, ongoing, completed] = await Promise.all([
            prisma.servico.count(),
            prisma.servico.count({
              where: {
                OR: [
                  { appointment: null },
                  { appointment: { status: { not: AppointmentStatus.CONCLUIDO } } },
                ],
              },
            }),
            prisma.servico.count({ where: { appointment: { status: AppointmentStatus.CONCLUIDO } } }),
          ]);

          summary.services = {
            total,
            ongoing,
            completed,
          };
        })(),
      );
    }

    if (hasModule(modules, 'services:read')) {
      jobs.push(
        (async () => {
          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const endOfToday = new Date(startOfToday);
          endOfToday.setDate(endOfToday.getDate() + 1);

          const endOfWeek = new Date(startOfToday);
          endOfWeek.setDate(endOfWeek.getDate() + 7);

          const [scheduled, confirmed, completed, today, upcomingWeek] = await Promise.all([
            prisma.appointment.count({ where: { status: AppointmentStatus.AGENDADO } }),
            prisma.appointment.count({ where: { status: AppointmentStatus.CONFIRMADO } }),
            prisma.appointment.count({ where: { status: AppointmentStatus.CONCLUIDO } }),
            prisma.appointment.count({
              where: {
                scheduledStart: {
                  gte: startOfToday,
                  lt: endOfToday,
                },
              },
            }),
            prisma.appointment.count({
              where: {
                scheduledStart: {
                  gte: startOfToday,
                  lt: endOfWeek,
                },
                status: {
                  in: [AppointmentStatus.AGENDADO, AppointmentStatus.CONFIRMADO],
                },
              },
            }),
          ]);

          summary.appointments = {
            scheduled,
            confirmed,
            completed,
            today,
            upcomingWeek,
          };
        })(),
      );
    }

    if (hasModule(modules, 'products:read')) {
      jobs.push(
        (async () => {
          const products = await prisma.product.findMany({
            where: { isActive: true },
            select: {
              estoqueAtual: true,
              estoqueMinimo: true,
            },
          });

          let critical = 0;
          let lowStock = 0;

          for (const product of products) {
            if (product.estoqueAtual <= product.estoqueMinimo) {
              critical += 1;
              continue;
            }

            const attentionThreshold = product.estoqueMinimo + Math.max(2, Math.ceil(product.estoqueMinimo * 0.25));
            if (product.estoqueAtual <= attentionThreshold) {
              lowStock += 1;
            }
          }

          summary.products = {
            critical,
            lowStock,
            totalActive: products.length,
          };
        })(),
      );
    }

    if (hasModule(modules, 'cashier:manage')) {
      jobs.push(
        (async () => {
          const now = new Date();

          const [blocked, open, partiallyPaid, paid, receivable, overdue, received] = await Promise.all([
            prisma.invoice.count({ where: { status: { slug: 'BLOQUEADA' } } }),
            prisma.invoice.count({ where: { status: { slug: 'ABERTA' } } }),
            prisma.invoice.count({ where: { status: { slug: 'PARCIALMENTE_QUITADA' } } }),
            prisma.invoice.count({ where: { status: { slug: 'QUITADA' } } }),
            prisma.invoiceInstallment.aggregate({
              where: { paidAt: null },
              _sum: { amount: true },
            }),
            prisma.invoiceInstallment.aggregate({
              where: { paidAt: null, dueDate: { lt: now } },
              _sum: { amount: true },
            }),
            prisma.invoiceInstallment.aggregate({
              where: { paidAt: { not: null } },
              _sum: { amount: true },
            }),
          ]);

          const toNumber = (value: Prisma.Decimal | null | undefined) => value?.toNumber() ?? 0;

          summary.invoices = {
            blocked,
            open,
            partiallyPaid,
            paid,
            receivableTotal: toNumber(receivable._sum.amount),
            overdueTotal: toNumber(overdue._sum.amount),
            receivedTotal: toNumber(received._sum.amount),
          };
        })(),
      );
    }

    if (hasModule(modules, 'owners:read')) {
      jobs.push(
        (async () => {
          const total = await prisma.owner.count();
          summary.owners = { total };
        })(),
      );
    }

    if (hasModule(modules, 'animals:read')) {
      jobs.push(
        (async () => {
          const total = await prisma.animal.count();
          summary.animals = { total };
        })(),
      );
    }

    await Promise.all(jobs);

    res.json({ summary });
  }),
);
