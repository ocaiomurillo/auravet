import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import type { Prisma } from '@prisma/client';

import { env } from '../config/env';
import { extractEnabledModuleSlugs } from './permissions';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_COST = Math.min(Math.max(env.PASSWORD_SALT_ROUNDS, 10), 18);
const SCRYPT_OPTIONS = { N: 2 ** SCRYPT_COST, r: 8, p: 1 } as const;

const runScrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey as Buffer);
    });
  });

export interface AuthenticatedUser {
  id: string;
  nome: string;
  email: string;
  role: {
    id: string;
    slug: string;
    name: string;
  };
  isActive: boolean;
  lastLoginAt: Date | null;
  modules: string[];
}

export interface TokenPayload {
  sub: string;
  roleId: string;
  modules: string[];
  exp: number;
}

export const hashPassword = async (password: string) => {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = await runScrypt(password, salt);
  return `${salt}:${derivedKey.toString('hex')}`;
};

export const verifyPassword = async (password: string, storedHash: string) => {
  const [salt, key] = storedHash.split(':');

  if (!salt || !key) {
    return false;
  }

  const derivedKey = await runScrypt(password, salt);
  const storedKey = Buffer.from(key, 'hex');

  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, derivedKey);
};

export type UserWithRole = Prisma.UserGetPayload<{
  include: {
    role: {
      include: {
        modules: {
          include: {
            module: true;
          };
        };
      };
    };
  };
}>;

export const buildAuthenticatedUser = (user: UserWithRole): AuthenticatedUser => {
  const modules = extractEnabledModuleSlugs(user.role.modules);

  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: {
      id: user.role.id,
      slug: user.role.slug,
      name: user.role.name,
    },
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null,
    modules,
  };
};

const base64UrlEncode = (input: string | Buffer) =>
  Buffer.from(input).toString('base64').replace(/=+$/u, '').replace(/\+/gu, '-').replace(/\//gu, '_');

const base64UrlDecode = (input: string) => {
  const normalized = input.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf8');
};

const parseExpiration = (expiresIn: string): number => {
  const match = /^([0-9]+)([smhd])$/i.exec(expiresIn.trim());
  if (!match) {
    throw new Error('Formato inválido para JWT_EXPIRES_IN. Utilize valores como 15m, 12h ou 7d.');
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return value;
  }
};

export const createAccessToken = (user: AuthenticatedUser) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const expiresInSeconds = parseExpiration(env.JWT_EXPIRES_IN);
  const payload: TokenPayload = {
    sub: user.id,
    roleId: user.role.id,
    modules: user.modules,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const headerSegment = base64UrlEncode(JSON.stringify(header));
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerSegment}.${payloadSegment}`;
  const signature = createHmac('sha256', env.JWT_SECRET).update(unsignedToken).digest('base64url');

  return `${unsignedToken}.${signature}`;
};

export const verifyToken = (token: string): TokenPayload => {
  const segments = token.split('.');

  if (segments.length !== 3) {
    throw new Error('Token inválido');
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac('sha256', env.JWT_SECRET).update(unsignedToken).digest('base64url');

  if (signature.length !== expectedSignature.length) {
    throw new Error('Assinatura inválida');
  }

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('Assinatura inválida');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as TokenPayload;

  if (!payload.sub || !payload.roleId || !payload.exp || !Array.isArray(payload.modules)) {
    throw new Error('Token inválido');
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expirado');
  }

  return payload;
};
