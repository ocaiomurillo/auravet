import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { once } from 'node:events';
import type { Server } from 'node:http';

import * as PrismaModule from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import type { InMemoryPrisma } from './helpers/prisma-mock';
import { createInMemoryPrisma } from './helpers/prisma-mock';

process.env.DATABASE_URL ??= 'file:memory:?schema=public';
process.env.JWT_SECRET ??= 'test-secret';
process.env.JWT_EXPIRES_IN ??= '15m';
process.env.PASSWORD_SALT_ROUNDS ??= '12';
process.env.AUTH_RATE_LIMIT_WINDOW_MS ??= '60000';
process.env.AUTH_RATE_LIMIT_MAX ??= '10';

const { Prisma } = PrismaModule;
(Prisma as unknown as { Decimal: typeof Decimal }).Decimal = Decimal;

const prismaMock = createInMemoryPrisma();
const prisma = prismaMock as InMemoryPrisma;

type AppModule = typeof import('../src/app.js');
type AuthModule = typeof import('../src/utils/auth.js');

let app: AppModule['app'];
let hashPassword: AuthModule['hashPassword'];
let server: Server;
let baseUrl: string;

const startServer = async () => {
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (address && typeof address === 'object') {
    baseUrl = `http://127.0.0.1:${address.port}`;
    return;
  }

  throw new Error('Não foi possível iniciar o servidor de testes.');
};

const stopServer = async () =>
  new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const post = async (path: string, body: unknown, token?: string) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await response.json() : null;
  return { response, data } as const;
};

const get = async (path: string, token?: string) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await response.json() : null;
  return { response, data } as const;
};

const ensureCashierOnlyRole = async () => {
  const existing = await prisma.role.findUnique({ where: { slug: 'TEST_CASHIER' } });
  if (existing) {
    return existing;
  }

  return prisma.role.create({
    data: {
      slug: 'TEST_CASHIER',
      name: 'Operador de Caixa',
      modules: {
        create: [{ module: { connect: { id: 'cashier:access' } }, isEnabled: true }],
      },
    },
  });
};

const seedCashierUser = async () => {
  const role = await ensureCashierOnlyRole();
  const passwordHash = await hashPassword('Cashier123!');
  await prisma.user.create({
    data: {
      nome: 'Colaborador Financeiro',
      email: 'cashier@auravet.com',
      passwordHash,
      roleId: role.id,
      isActive: true,
    },
  });
};

before(async () => {
  globalThis.__PRISMA__ = prismaMock;
  const [{ app: importedApp }, authModule] = await Promise.all<[
    Promise<AppModule>,
    Promise<AuthModule>,
  ]>([
    import('../src/app.js'),
    import('../src/utils/auth.js'),
  ]);

  app = importedApp;
  hashPassword = authModule.hashPassword;

  await startServer();
});

after(async () => {
  await stopServer();
});

beforeEach(async () => {
  prisma.reset();
  await seedCashierUser();
});

describe('Dashboard summary', () => {
  it('includes receivables metrics when the cashier module is enabled', async () => {
    (prismaMock as any).invoice = {
      async findMany() {
        return [
          { total: new Decimal(120), status: { slug: 'ABERTA' } },
          { total: new Decimal(80), status: { slug: 'QUITADA' } },
          { total: new Decimal(200.5), status: { slug: 'QUITADA' } },
        ];
      },
    };

    const login = await post('/auth/login', {
      email: 'cashier@auravet.com',
      password: 'Cashier123!',
    });

    const token = login.data?.token as string;
    assert.ok(token);

    const { response, data } = await get('/dashboard/summary', token);

    assert.equal(response.status, 200);
    assert.deepEqual(data, {
      summary: {
        receivables: {
          openTotal: 120,
          paidTotal: 280.5,
          openCount: 1,
          paidCount: 2,
        },
      },
    });
  });
});
