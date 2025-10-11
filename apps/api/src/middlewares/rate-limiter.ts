import type { RequestHandler } from 'express';

import { HttpError } from '../utils/http-error';

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

interface RateEntry {
  count: number;
  resetTimeout: NodeJS.Timeout;
}

export const createRateLimiter = ({ windowMs, max, message }: RateLimiterOptions): RequestHandler => {
  const hits = new Map<string, RateEntry>();
  const errorMessage = message ?? 'Muitas tentativas. Tente novamente em instantes.';

  return (req, _res, next) => {
    const key = req.ip || req.headers['x-forwarded-for']?.toString() || 'global';
    const existing = hits.get(key);

    if (!existing) {
      const timeout = setTimeout(() => {
        hits.delete(key);
      }, windowMs);
      timeout.unref?.();
      hits.set(key, { count: 1, resetTimeout: timeout });
      next();
      return;
    }

    if (existing.count >= max) {
      next(new HttpError(429, errorMessage));
      return;
    }

    existing.count += 1;
    next();
  };
};
