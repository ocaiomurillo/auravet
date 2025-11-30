import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requireAnyPermission } from '../middlewares/require-permission';
import { paymentConditionIdSchema, paymentConditionPayloadSchema } from '../schema/payment-condition';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { financePermissions } from '../utils/permissions';

const serializePaymentCondition = (condition: {
  id: string;
  nome: string;
  prazoDias: number;
  parcelas: number;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...condition,
  createdAt: condition.createdAt.toISOString(),
  updatedAt: condition.updatedAt.toISOString(),
});

export const paymentConditionsRouter = Router();

paymentConditionsRouter.use(authenticate);
paymentConditionsRouter.use(requireAnyPermission(...financePermissions));

paymentConditionsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const conditions = await prisma.paymentCondition.findMany({ orderBy: { nome: 'asc' } });
    res.json(conditions.map(serializePaymentCondition));
  }),
);

paymentConditionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = paymentConditionPayloadSchema.parse(req.body);
    const condition = await prisma.paymentCondition.create({ data: payload });
    res.status(201).json(serializePaymentCondition(condition));
  }),
);

paymentConditionsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = paymentConditionIdSchema.parse(req.params);
    const payload = paymentConditionPayloadSchema.parse(req.body);

    const condition = await prisma.paymentCondition.update({ where: { id }, data: payload });
    res.json(serializePaymentCondition(condition));
  }),
);

paymentConditionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = paymentConditionIdSchema.parse(req.params);

    const invoicesUsing = await prisma.invoice.count({ where: { paymentConditionId: id } });
    if (invoicesUsing > 0) {
      throw new HttpError(
        400,
        'Esta condição já foi usada em faturas. Cadastre uma nova opção e atualize as contas antes de removê-la.',
      );
    }

    await prisma.paymentCondition.delete({ where: { id } });
    res.status(204).end();
  }),
);
