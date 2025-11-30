import type { RequestHandler } from 'express';

import { HttpError } from '../utils/http-error';
import { expandWithAliases } from '../utils/permissions';

export const requirePermission = (...modules: string[]): RequestHandler => {
  if (modules.length === 0) {
    throw new Error('É necessário informar ao menos uma permissão para a verificação.');
  }

  const allowedModules = expandWithAliases(modules);
  const expandUserModules = (userModules?: string[]) => expandWithAliases(userModules ?? []);

  return (req, _res, next) => {
    if (!req.user) {
      throw new HttpError(401, 'Autenticação obrigatória.');
    }

    const userModules = expandUserModules(req.user.modules);

    const allowed = allowedModules.some((module) => userModules.includes(module));

    if (!allowed) {
      throw new HttpError(403, 'Você não tem permissão para acessar este recurso.');
    }

    next();
  };
};

export const requireAnyPermission = (...modules: string[]): RequestHandler => requirePermission(...modules);
