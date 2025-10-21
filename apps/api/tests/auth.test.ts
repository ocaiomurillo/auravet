import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { once } from 'node:events';
import { randomBytes, scryptSync } from 'node:crypto';
import type { Server } from 'node:http';

import type { InMemoryPrisma } from './helpers/prisma-mock';
import { createInMemoryPrisma } from './helpers/prisma-mock';

process.env.DATABASE_URL ??= 'file:memory:?schema=public';
process.env.JWT_SECRET ??= 'test-secret';
process.env.JWT_EXPIRES_IN ??= '15m';
process.env.PASSWORD_SALT_ROUNDS ??= '12';
process.env.AUTH_RATE_LIMIT_WINDOW_MS ??= '60000';
process.env.AUTH_RATE_LIMIT_MAX ??= '10';

const LEGACY_SALT_LENGTH = 16;
const LEGACY_KEY_LENGTH = 64;
const MIN_SCRYPT_COST = 10;
const MAX_SCRYPT_COST = 18;

const clampCost = (cost: number) =>
  Math.min(Math.max(Math.round(cost), MIN_SCRYPT_COST), MAX_SCRYPT_COST);

const createLegacyPasswordHash = (password: string, cost: number) => {
  const normalizedCost = clampCost(cost);
  const salt = randomBytes(LEGACY_SALT_LENGTH).toString('hex');
  const derivedKey = scryptSync(password, salt, LEGACY_KEY_LENGTH, {
    N: 2 ** normalizedCost,
    r: 8,
    p: 1,
  });

  return `${salt}:${derivedKey.toString('hex')}`;
};

const ADMIN_EMAIL = 'admin@auravet.com';
const ADMIN_PASSWORD = 'Admin123!';

const prismaMock = createInMemoryPrisma();
const prisma = prismaMock as InMemoryPrisma;

type HashPassword = (password: string, cost?: number) => Promise<string>;

type AppModule = typeof import('../src/app.js');
type AuthModule = typeof import('../src/utils/auth.js');

let app: AppModule['app'];
let hashPassword: HashPassword;
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

const seedAdminUser = async () => {
  await prisma.user.deleteMany();
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const adminRole = await prisma.role.findUnique({ where: { slug: 'ADMINISTRADOR' } });
  assert.ok(adminRole);
  await prisma.user.create({
    data: {
      nome: 'Admin Auravet',
      email: ADMIN_EMAIL,
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });
};

const updateAdminPasswordHash = async (passwordHash: string) => {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  assert.ok(admin);
  await prisma.user.update({ where: { id: admin.id }, data: { passwordHash } });
};

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

const patch = async (path: string, body: unknown, token?: string) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
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
  await seedAdminUser();
});

describe('Authentication flows', () => {
  it('allows a user to login with valid credentials', async () => {
    const { response, data } = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    assert.equal(response.status, 200);
    assert.ok(data?.token);
    assert.equal(data?.user.email, ADMIN_EMAIL);
    assert.ok(Array.isArray(data?.user.modules));
    assert.ok(data?.user.modules.includes('users:manage'));
    assert.equal(data?.user.role.slug, 'ADMINISTRADOR');
  });

  it('rejects login with invalid credentials', async () => {
    const { response } = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: 'invalid-password',
    });

    assert.equal(response.status, 401);
  });

  it('allows administrators to register new collaborators', async () => {
    const login = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    const token = login.data?.token as string;
    assert.ok(token);

    const assistantRole = await prisma.role.findUnique({ where: { slug: 'ASSISTENTE_ADMINISTRATIVO' } });
    assert.ok(assistantRole);

    const { response, data } = await post(
      '/auth/register',
      {
        nome: 'Novo Colaborador',
        email: 'colaborador@auravet.com',
        password: 'Assist123!',
        roleId: assistantRole.id,
      },
      token,
    );

    assert.equal(response.status, 201);
    assert.equal(data?.user.email, 'colaborador@auravet.com');
    assert.ok(Array.isArray(data?.user.modules));
    assert.ok(!data?.user.modules.includes('users:manage'));
  });

  it('allows administrators to register new collaborators using role slug identifiers', async () => {
    const login = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    const token = login.data?.token as string;
    assert.ok(token);

    const assistantRole = await prisma.role.findUnique({
      where: { slug: 'ASSISTENTE_ADMINISTRATIVO' },
      include: {
        modules: {
          include: { module: true },
        },
      },
    });

    assert.ok(assistantRole);

    const expectedModules = assistantRole.modules
      .filter((module) => module.isEnabled && module.module.isActive)
      .map((module) => module.module.slug)
      .sort();

    const { response, data } = await post(
      '/auth/register',
      {
        nome: 'Colaborador Slug',
        email: 'colaborador.slug@auravet.com',
        password: 'Assist123!',
        roleId: 'ASSISTENTE_ADMINISTRATIVO',
      },
      token,
    );

    assert.equal(response.status, 201);
    assert.equal(data?.user.email, 'colaborador.slug@auravet.com');
    assert.equal(data?.user.role.slug, 'ASSISTENTE_ADMINISTRATIVO');
    assert.equal(data?.user.role.id, assistantRole.id);
    assert.deepEqual(data?.user.modules, expectedModules);
  });

  it('blocks non administrators from creating users', async () => {
    const assistantPassword = 'Assist123!';
    const assistantHash = await hashPassword(assistantPassword);
    const assistantRole = await prisma.role.findUnique({ where: { slug: 'ASSISTENTE_ADMINISTRATIVO' } });
    assert.ok(assistantRole);

    await prisma.user.create({
      data: {
        nome: 'Assistente',
        email: 'assistente@auravet.com',
        passwordHash: assistantHash,
        roleId: assistantRole.id,
        isActive: true,
      },
    });

    const assistantLogin = await post('/auth/login', {
      email: 'assistente@auravet.com',
      password: assistantPassword,
    });

    const token = assistantLogin.data?.token as string;
    assert.ok(token);

    const { response } = await post(
      '/auth/register',
      {
        nome: 'Outro Usuário',
        email: 'outro@auravet.com',
        password: 'Assist123!',
        roleId: assistantRole.id,
      },
      token,
    );

    assert.equal(response.status, 403);
  });

  it('allows a user to login when the password hash uses a different cost', async () => {
    const increasedCost = 13;
    const passwordHash = await hashPassword(ADMIN_PASSWORD, increasedCost);
    await updateAdminPasswordHash(passwordHash);

    const { response, data } = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    assert.equal(response.status, 200);
    assert.ok(data?.token);
    assert.equal(data?.user.email, ADMIN_EMAIL);
  });

  it('allows a user to login with a legacy password hash after cost changes', async () => {
    const legacyCost = 11;
    const legacyHash = createLegacyPasswordHash(ADMIN_PASSWORD, legacyCost);
    await updateAdminPasswordHash(legacyHash);

    const { response, data } = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    assert.equal(response.status, 200);
    assert.ok(data?.token);
    assert.equal(data?.user.email, ADMIN_EMAIL);
  });
});

describe('Role management flows', () => {
  it('allows administrators to update role modules using slug identifiers', async () => {
    const login = await post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    const token = login.data?.token as string;
    assert.ok(token);

    const { response, data } = await patch(
      '/roles/ADMINISTRADOR/modules',
      {
        modules: [
          {
            moduleId: 'owners:read',
            isEnabled: false,
          },
        ],
      },
      token,
    );

    assert.equal(response.status, 200);
    const modules = (data as { role: { modules: Array<{ slug: string; isEnabled: boolean }> } }).role.modules;
    const ownersReadModule = modules.find((module) => module.slug === 'owners:read');
    assert.ok(ownersReadModule);
    assert.equal(ownersReadModule?.isEnabled, false);
  });
});
