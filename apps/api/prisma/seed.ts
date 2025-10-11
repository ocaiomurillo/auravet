import { PrismaClient, Role } from '@prisma/client';

import { hashPassword } from '../src/utils/auth';

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
