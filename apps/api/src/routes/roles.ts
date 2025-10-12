import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import { roleCreateSchema, roleIdParamSchema, roleModuleUpdateSchema, roleUpdateSchema } from '../schema/role';
import { asyncHandler } from '../utils/async-handler';
import { HttpError } from '../utils/http-error';
import { isPrismaKnownError } from '../utils/prisma-error';
import { serializeModule, serializeRole } from '../utils/serializers';

export const rolesRouter = Router();

rolesRouter.use(authenticate);
rolesRouter.use(requirePermission('users:manage'));

rolesRouter.get(
  '/modules',
  asyncHandler(async (_req, res) => {
    const modules = await prisma.module.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({ modules: modules.map(serializeModule) });
  }),
);

rolesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        modules: {
          include: { module: true },
        },
      },
    });

    res.json({ roles: roles.map(serializeRole) });
  }),
);

rolesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = roleCreateSchema.parse(req.body);

    try {
      const role = await prisma.role.create({
        data: {
          name: payload.name,
          slug: payload.slug,
          description: payload.description ?? null,
          modules: payload.moduleIds.length
            ? {
                create: payload.moduleIds.map((moduleId) => ({
                  module: { connect: { id: moduleId } },
                  isEnabled: true,
                })),
              }
            : undefined,
        },
        include: {
          modules: {
            include: { module: true },
          },
        },
      });

      res.status(201).json({ role: serializeRole(role) });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2002')) {
        throw new HttpError(409, 'Já existe uma função com este identificador.');
      }

      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(400, 'Um dos módulos informados não existe.');
      }

      throw error;
    }
  }),
);

rolesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = roleIdParamSchema.parse(req.params);

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        modules: {
          include: { module: true },
        },
      },
    });

    if (!role) {
      throw new HttpError(404, 'Função não encontrada.');
    }

    res.json({ role: serializeRole(role) });
  }),
);

rolesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = roleIdParamSchema.parse(req.params);
    const payload = roleUpdateSchema.parse(req.body);

    try {
      const role = await prisma.role.update({
        where: { id },
        data: payload,
        include: {
          modules: {
            include: { module: true },
          },
        },
      });

      res.json({ role: serializeRole(role) });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Função não encontrada.');
      }

      throw error;
    }
  }),
);

rolesRouter.patch(
  '/:id/modules',
  asyncHandler(async (req, res) => {
    const { id } = roleIdParamSchema.parse(req.params);
    const payload = roleModuleUpdateSchema.parse(req.body);

    const role = await prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw new HttpError(404, 'Função não encontrada.');
    }

    await prisma.$transaction(
      payload.modules.map(({ moduleId, isEnabled }) =>
        prisma.roleModuleAccess.upsert({
          where: {
            roleId_moduleId: {
              roleId: id,
              moduleId,
            },
          },
          update: { isEnabled },
          create: { roleId: id, moduleId, isEnabled },
        }),
      ),
    );

    const updatedRole = await prisma.role.findUnique({
      where: { id },
      include: {
        modules: {
          include: { module: true },
        },
      },
    });

    if (!updatedRole) {
      throw new HttpError(404, 'Função não encontrada.');
    }

    res.json({ role: serializeRole(updatedRole) });
  }),
);

rolesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = roleIdParamSchema.parse(req.params);

    try {
      await prisma.role.delete({ where: { id } });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new HttpError(404, 'Função não encontrada.');
      }

      if (isPrismaKnownError(error, 'P2003')) {
        throw new HttpError(400, 'Não é possível remover uma função atribuída a usuários.');
      }

      throw error;
    }

    res.status(204).end();
  }),
);
