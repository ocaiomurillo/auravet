import fs from 'node:fs/promises';
import path from 'node:path';

import { prisma } from './prisma';

type MigrationRecord = {
  migration_name: string;
  finished_at: Date | null;
};

const migrationsDirectory = path.resolve(process.cwd(), 'prisma/migrations');

export const ensureDatabaseIsMigrated = async () => {
  let migrationFolders: string[];

  try {
    const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true });
    migrationFolders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    console.error(`❌ Não foi possível ler a pasta de migrações em ${migrationsDirectory}.`, error);
    throw error;
  }

  let appliedMigrations: MigrationRecord[];
  try {
    appliedMigrations = await prisma.$queryRaw<MigrationRecord[]>`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
    `;
  } catch (error) {
    console.error('❌ Não foi possível consultar o estado das migrações no banco. Execute "prisma migrate deploy".', error);
    throw error;
  }

  const appliedMigrationNames = new Set(
    appliedMigrations.filter((migration) => migration.finished_at !== null).map((migration) => migration.migration_name),
  );

  const pendingMigrations = migrationFolders.filter((migration) => !appliedMigrationNames.has(migration));

  if (pendingMigrations.length > 0) {
    throw new Error(
      `Há migrações pendentes no banco: ${pendingMigrations.join(', ')}. Execute "npx prisma migrate deploy" antes de iniciar a API.`,
    );
  }
};
