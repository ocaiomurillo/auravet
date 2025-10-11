import type { RequestHandler } from 'express';

import type { Permission } from '../utils/permissions';
import { HttpError } from '../utils/http-error';

export const requirePermission = (...permissions: Permission[]): RequestHandler => {
  if (permissions.length === 0) {
    throw new Error('É necessário informar ao menos uma permissão para a verificação.');
  }

  return (req, _res, next) => {
    if (!req.user) {
      throw new HttpError(401, 'Autenticação obrigatória.');
    }

    const allowed = permissions.some((permission) => req.user?.permissions.includes(permission));

    if (!allowed) {
      throw new HttpError(403, 'Você não tem permissão para acessar este recurso.');
    }

    next();
  };
};
