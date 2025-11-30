import type { RequestHandler } from 'express';

import { HttpError } from '../utils/http-error';

const PERMISSION_ALIASES: Record<string, string[]> = {
  'attendances:manage': ['services:manage', 'services:write'],
  'attendances:read': ['services:read'],
  'cashier:access': ['cashier:manage'],
  'cashier:manage': ['cashier:access'],
  'services:manage': ['attendances:manage', 'services:write'],
  'services:read': ['attendances:read', 'attendances:manage'],
  'services:write': ['attendances:manage', 'services:manage'],
};

const expandRequestedModules = (requested: string[]): string[] =>
  Array.from(
    new Set(
      requested.flatMap((module) => [module, ...(PERMISSION_ALIASES[module] ?? [])]),
    ),
  );

export const requirePermission = (...modules: string[]): RequestHandler => {
  if (modules.length === 0) {
    throw new Error('É necessário informar ao menos uma permissão para a verificação.');
  }

  const allowedModules = expandRequestedModules(modules);

  return (req, _res, next) => {
    if (!req.user) {
      throw new HttpError(401, 'Autenticação obrigatória.');
    }

    const allowed = allowedModules.some((module) => req.user?.modules.includes(module));

    if (!allowed) {
      throw new HttpError(403, 'Você não tem permissão para acessar este recurso.');
    }

    next();
  };
};

export const requireAnyPermission = (...modules: string[]): RequestHandler => requirePermission(...modules);
