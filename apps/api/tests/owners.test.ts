import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { once } from 'node:events';
import type { Server } from 'node:http';

import type { InMemoryPrisma } from './helpers/prisma-mock';
import { createInMemoryPrisma } from './helpers/prisma-mock';

process.env.DATABASE_URL ??= 'file:memory:?schema=public';
process.env.JWT_SECRET ??= 'test-secret';
process.env.JWT_EXPIRES_IN ??= '15m';
process.env.PASSWORD_SALT_ROUNDS ??= '12';
process.env.AUTH_RATE_LIMIT_WINDOW_MS ??= '60000';
process.env.AUTH_RATE_LIMIT_MAX ??= '10';

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

const seedCashierUser = async () => {
  await prisma.user.deleteMany();
  const passwordHash = await hashPassword('Cashier123!');
  const accountantRole = await prisma.role.findUnique({ where: { slug: 'CONTADOR' } });
  assert.ok(accountantRole);
  await prisma.user.create({
    data: {
      nome: 'Contador Auravet',
      email: 'cashier@auravet.com',
      passwordHash,
      roleId: accountantRole.id,
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

describe('Owner access for cashier role', () => {
  it('allows cashier users to list basic owner data', async () => {
    await prisma.owner.create({
      data: {
        nome: 'Alice Tutor',
        email: 'alice@auravet.com',
      },
    });

    const login = await post('/auth/login', {
      email: 'cashier@auravet.com',
      password: 'Cashier123!',
    });

    const token = login.data?.token as string;
    assert.ok(token);

    const { response, data } = await get('/owners/basic', token);

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(data));
    assert.equal(data?.length, 1);

    const [owner] = data as Array<{
      id: string;
      nome: string;
      email: string;
      telefone: string | null;
      cpf: string | null;
      createdAt: string;
    }>;

    assert.equal(owner.nome, 'Alice Tutor');
    assert.equal(owner.email, 'alice@auravet.com');
    assert.equal(owner.telefone, null);
    assert.equal(owner.cpf, null);
    assert.ok(owner.createdAt);
  });

  it('blocks cashier users from fetching the detailed owners listing', async () => {
    const login = await post('/auth/login', {
      email: 'cashier@auravet.com',
      password: 'Cashier123!',
    });

    const token = login.data?.token as string;
    assert.ok(token);

    const { response } = await get('/owners', token);

    assert.equal(response.status, 403);
  });
});
