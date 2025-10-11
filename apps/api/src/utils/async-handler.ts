import { NextFunction, Request, Response } from 'express';

type Handler<T extends Request = Request, U extends Response = Response> = (
  req: T,
  res: U,
  next: NextFunction,
) => Promise<unknown> | unknown;

export const asyncHandler = <T extends Request, U extends Response>(handler: Handler<T, U>) =>
  (req: T, res: U, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
