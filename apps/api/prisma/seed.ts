import { randomBytes, scrypt as scryptCallback } from 'crypto';

import { Prisma, PrismaClient } from '@prisma/client';

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
const ADMIN_ROLE_SLUG = 'ADMINISTRADOR';

const DEFAULT_COLLABORATORS = [
  {
    slug: 'MEDICO',
    nome: 'Dra. Aurora Campos',
    email: 'dra.aurora@auravet.com',
    password: process.env.SEED_DOCTOR_PASSWORD ?? 'VetAurora123!',
    profile: {
      especialidade: 'Clínica geral e felinos',
      crmv: 'CRMV-SP 12345',
      turnos: ['MANHA', 'TARDE'],
      bio: 'Apaixonada por medicina preventiva e pelo cuidado gentil com gatos e cães.',
    },
  },
  {
    slug: 'ENFERMEIRO',
    nome: 'Enf. Theo Ribeiro',
    email: 'enf.theo@auravet.com',
    password: process.env.SEED_NURSE_PASSWORD ?? 'NurseTheo123!',
    profile: {
      especialidade: 'Enfermagem cirúrgica e internação',
      crmv: 'CRMV-SP 67890',
      turnos: ['TARDE', 'NOITE'],
      bio: 'Responsável pelos cuidados assistenciais e pela preparação de procedimentos.',
    },
  },
] as const;

const DEFAULT_MODULES = [
  {
    slug: 'owners:read',
    name: 'Visualizar tutores',
    description: 'Permite visualizar a lista de tutores cadastrados.',
  },
  {
    slug: 'owners:write',
    name: 'Gerenciar tutores',
    description: 'Permite criar e editar tutores.',
  },
  {
    slug: 'animals:read',
    name: 'Visualizar animais',
    description: 'Permite visualizar animais cadastrados.',
  },
  {
    slug: 'animals:write',
    name: 'Gerenciar animais',
    description: 'Permite cadastrar e editar animais.',
  },
  {
    slug: 'services:read',
    name: 'Visualizar serviços',
    description: 'Permite visualizar os serviços prestados.',
  },
  {
    slug: 'services:write',
    name: 'Gerenciar serviços',
    description: 'Permite registrar e atualizar serviços.',
  },
  {
    slug: 'products:read',
    name: 'Visualizar produtos',
    description: 'Permite acompanhar o catálogo e estoque de produtos.',
  },
  {
    slug: 'products:write',
    name: 'Gerenciar produtos',
    description: 'Permite cadastrar produtos e ajustar estoque.',
  },
  {
    slug: 'users:manage',
    name: 'Administrar usuários',
    description: 'Permite criar e gerenciar usuários e funções.',
  },
  {
    slug: 'cashier:access',
    name: 'Caixa',
    description: 'Permite gerenciar contas a receber e registrar pagamentos.',
  },
] as const;

const DEFAULT_ROLES: Array<{
  slug: string;
  name: string;
  description?: string;
  modules: string[];
}> = [
  {
    slug: 'ADMINISTRADOR',
    name: 'Administrador',
    description: 'Acesso completo ao ecossistema Auravet.',
    modules: DEFAULT_MODULES.map((module) => module.slug),
  },
  {
    slug: 'AUXILIAR_ADMINISTRATIVO',
    name: 'Auxiliar Administrativo',
    modules: [
      'owners:read',
      'owners:write',
      'animals:read',
      'animals:write',
      'services:read',
      'products:read',
      'products:write',
      'cashier:access',
    ],
  },
  {
    slug: 'ASSISTENTE_ADMINISTRATIVO',
    name: 'Assistente Administrativo',
    modules: ['owners:read', 'animals:read', 'services:read', 'products:read', 'cashier:access'],
  },
  {
    slug: 'ENFERMEIRO',
    name: 'Enfermeiro',
    modules: [
      'owners:read',
      'animals:read',
      'animals:write',
      'services:read',
      'services:write',
      'products:read',
      'products:write',
    ],
  },
  {
    slug: 'MEDICO',
    name: 'Médico',
    modules: ['owners:read', 'animals:read', 'services:read', 'services:write', 'products:read'],
  },
  {
    slug: 'CONTADOR',
    name: 'Contador',
    modules: ['services:read', 'products:read', 'cashier:access'],
  },
];

const DEFAULT_INVOICE_STATUSES = [
  { slug: 'ABERTA', name: 'Aberta' },
  { slug: 'QUITADA', name: 'Quitada' },
] as const;

async function main() {
  const modules = await Promise.all(
    DEFAULT_MODULES.map((module) =>
      prisma.module.upsert({
        where: { slug: module.slug },
        update: {
          name: module.name,
          description: module.description,
          isActive: true,
        },
        create: {
          slug: module.slug,
          name: module.name,
          description: module.description,
        },
      }),
    ),
  );

  const moduleMap = new Map(modules.map((module) => [module.slug, module]));

  const roles = await Promise.all(
    DEFAULT_ROLES.map(async (role) => {
      const savedRole = await prisma.role.upsert({
        where: { slug: role.slug },
        update: {
          name: role.name,
          description: role.description,
          isActive: true,
        },
        create: {
          slug: role.slug,
          name: role.name,
          description: role.description,
        },
      });

      await prisma.roleModuleAccess.deleteMany({ where: { roleId: savedRole.id } });

      const modulesToAssign = role.modules
        .map((slug) => moduleMap.get(slug))
        .filter((module): module is (typeof modules)[number] => Boolean(module))
        .map((module) => ({
          roleId: savedRole.id,
          moduleId: module.id,
          isEnabled: true,
        }));

      if (modulesToAssign.length > 0) {
        await prisma.roleModuleAccess.createMany({ data: modulesToAssign, skipDuplicates: true });
      }

      return savedRole;
    }),
  );

  const adminRole = roles.find((role) => role.slug === ADMIN_ROLE_SLUG);

  if (!adminRole) {
    throw new Error('Função de administrador não encontrada na seed.');
  }

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    create: {
      nome: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
    update: {
      nome: DEFAULT_ADMIN_NAME,
      roleId: adminRole.id,
      isActive: true,
      passwordHash,
    },
  });

  console.log(`👩‍⚕️ Usuário administrador pronto: ${admin.email}`);

  for (const collaborator of DEFAULT_COLLABORATORS) {
    const role = roles.find((item) => item.slug === collaborator.slug);

    if (!role) {
      console.warn(`⚠️  Função ${collaborator.slug} não encontrada. Perfil ${collaborator.email} não será criado.`);
      continue;
    }

    const collaboratorPasswordHash = await hashPassword(collaborator.password);

    const user = await prisma.user.upsert({
      where: { email: collaborator.email },
      create: {
        nome: collaborator.nome,
        email: collaborator.email,
        passwordHash: collaboratorPasswordHash,
        roleId: role.id,
        isActive: true,
      },
      update: {
        nome: collaborator.nome,
        roleId: role.id,
        isActive: true,
        passwordHash: collaboratorPasswordHash,
      },
    });

    await prisma.collaboratorProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        especialidade: collaborator.profile.especialidade,
        crmv: collaborator.profile.crmv,
        turnos: [...collaborator.profile.turnos],
        bio: collaborator.profile.bio,
      },
      update: {
        especialidade: collaborator.profile.especialidade,
        crmv: collaborator.profile.crmv,
        turnos: [...collaborator.profile.turnos],
        bio: collaborator.profile.bio,
      },
    });

    console.log(`🤝 Perfil clínico pronto: ${collaborator.email}`);
  }

  const invoiceStatuses = await Promise.all(
    DEFAULT_INVOICE_STATUSES.map((status) =>
      prisma.invoiceStatus.upsert({
        where: { slug: status.slug },
        update: { name: status.name },
        create: { slug: status.slug, name: status.name },
      }),
    ),
  );

  const statusMap = new Map(invoiceStatuses.map((status) => [status.slug, status]));
  const openStatus = statusMap.get('ABERTA');

  if (openStatus) {
    const servicesWithoutInvoice = await prisma.servico.findMany({
      where: { invoiceItems: { none: {} } },
      include: {
        animal: { include: { owner: true } },
        items: { include: { product: true } },
      },
    });

    for (const service of servicesWithoutInvoice) {
      const productsTotal = service.items.reduce(
        (acc, item) => acc.add(item.valorTotal),
        new Prisma.Decimal(0),
      );
      const total = service.preco.add(productsTotal);

      const dueDate = new Date(service.data);
      dueDate.setDate(dueDate.getDate() + 7);

      await prisma.invoice.create({
        data: {
          ownerId: service.animal.ownerId,
          statusId: openStatus.id,
          total,
          dueDate,
          items: {
            create: [
              {
                servicoId: service.id,
                description: `Serviço: ${service.tipo}`,
                quantity: 1,
                unitPrice: service.preco,
                total: service.preco,
              },
              ...service.items.map((item) => ({
                productId: item.productId,
                description: item.product ? `Produto: ${item.product.nome}` : 'Produto utilizado',
                quantity: item.quantidade,
                unitPrice: item.valorUnitario,
                total: item.valorTotal,
              })),
            ],
          },
        },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error('Não foi possível executar o seed inicial', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
