import { randomBytes, scrypt as scryptCallback } from 'crypto';

import { PrismaClient, Role } from '@prisma/client';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

const parseSaltRounds = () => {
  const rawValue = process.env.PASSWORD_SALT_ROUNDS;
  const parsedValue = rawValue ? Number(rawValue) : 10;

  if (!Number.isFinite(parsedValue)) {
    return 10;
  }

  return parsedValue;
};

const SCRYPT_COST = Math.min(Math.max(parseSaltRounds(), 10), 18);
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

const hashPassword = async (password: string) => {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = await runScrypt(password, salt);
  return `${salt}:${derivedKey.toString('hex')}`;
};

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@auravet.com';
const DEFAULT_ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Administrador Auravet';
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
async function main() {
  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    create: {
      nome: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      role: Role.ADMINISTRADOR,
      isActive: true,
    },
    update: {
      nome: DEFAULT_ADMIN_NAME,
      role: Role.ADMINISTRADOR,
      isActive: true,
      passwordHash,
    },
  });

  console.log(`👩‍⚕️ Usuário administrador pronto: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error('Não foi possível executar o seed inicial', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
