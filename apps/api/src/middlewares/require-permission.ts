import type { RequestHandler } from 'express';

import { HttpError } from '../utils/http-error';

export const requirePermission = (...modules: string[]): RequestHandler => {
  if (modules.length === 0) {
    throw new Error('É necessário informar ao menos uma permissão para a verificação.');
  }

  return (req, _res, next) => {
    if (!req.user) {
      throw new HttpError(401, 'Autenticação obrigatória.');
    }

    const allowed = modules.some((module) => req.user?.modules.includes(module));

    if (!allowed) {
      throw new HttpError(403, 'Você não tem permissão para acessar este recurso.');
    }

    next();
  };
};
