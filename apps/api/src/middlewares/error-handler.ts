import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { HttpError } from '../utils/http-error';

export const errorHandler = (err: unknown, _req: Request, res: Response) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
      details: err.details,
    });
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      error: 'Erro de validação',
      details: err.flatten(),
    });
  }

  console.error(err);
  return res.status(500).json({
    error: 'Erro interno inesperado',
  });
};
