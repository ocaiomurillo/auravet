-- Rename old enum type to avoid name collision with new table
ALTER TYPE "Role" RENAME TO "RoleEnum";

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleModuleAccess" (
    "roleId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "RoleModuleAccess_pkey" PRIMARY KEY ("roleId","moduleId")
);

-- AddColumn
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

-- Seed base modules
INSERT INTO "Module" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
    ('owners:read', 'Visualizar tutores', 'owners:read', 'Permite visualizar a lista de tutores cadastrados.', NOW(), NOW()),
    ('owners:write', 'Gerenciar tutores', 'owners:write', 'Permite criar e editar tutores.', NOW(), NOW()),
    ('animals:read', 'Visualizar animais', 'animals:read', 'Permite visualizar animais cadastrados.', NOW(), NOW()),
    ('animals:write', 'Gerenciar animais', 'animals:write', 'Permite cadastrar e editar animais.', NOW(), NOW()),
    ('services:read', 'Visualizar serviços', 'services:read', 'Permite visualizar os serviços prestados.', NOW(), NOW()),
    ('services:write', 'Gerenciar serviços', 'services:write', 'Permite registrar e atualizar serviços.', NOW(), NOW()),
    ('users:manage', 'Administrar usuários', 'users:manage', 'Permite criar e gerenciar usuários e funções.', NOW(), NOW());

-- Seed roles
INSERT INTO "Role" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
    ('ADMINISTRADOR', 'Administrador', 'ADMINISTRADOR', 'Acesso completo ao ecossistema Auravet.', NOW(), NOW()),
    ('AUXILIAR_ADMINISTRATIVO', 'Auxiliar Administrativo', 'AUXILIAR_ADMINISTRATIVO', NULL, NOW(), NOW()),
    ('ASSISTENTE_ADMINISTRATIVO', 'Assistente Administrativo', 'ASSISTENTE_ADMINISTRATIVO', NULL, NOW(), NOW()),
    ('ENFERMEIRO', 'Enfermeiro', 'ENFERMEIRO', NULL, NOW(), NOW()),
    ('MEDICO', 'Médico', 'MEDICO', NULL, NOW(), NOW()),
    ('CONTADOR', 'Contador', 'CONTADOR', NULL, NOW(), NOW());

-- Link roles to modules
INSERT INTO "RoleModuleAccess" ("roleId", "moduleId", "isEnabled") VALUES
    ('ADMINISTRADOR', 'owners:read', true),
    ('ADMINISTRADOR', 'owners:write', true),
    ('ADMINISTRADOR', 'animals:read', true),
    ('ADMINISTRADOR', 'animals:write', true),
    ('ADMINISTRADOR', 'services:read', true),
    ('ADMINISTRADOR', 'services:write', true),
    ('ADMINISTRADOR', 'users:manage', true),

    ('AUXILIAR_ADMINISTRATIVO', 'owners:read', true),
    ('AUXILIAR_ADMINISTRATIVO', 'owners:write', true),
    ('AUXILIAR_ADMINISTRATIVO', 'animals:read', true),
    ('AUXILIAR_ADMINISTRATIVO', 'animals:write', true),
    ('AUXILIAR_ADMINISTRATIVO', 'services:read', true),

    ('ASSISTENTE_ADMINISTRATIVO', 'owners:read', true),
    ('ASSISTENTE_ADMINISTRATIVO', 'animals:read', true),
    ('ASSISTENTE_ADMINISTRATIVO', 'services:read', true),

    ('ENFERMEIRO', 'owners:read', true),
    ('ENFERMEIRO', 'animals:read', true),
    ('ENFERMEIRO', 'animals:write', true),
    ('ENFERMEIRO', 'services:read', true),
    ('ENFERMEIRO', 'services:write', true),

    ('MEDICO', 'owners:read', true),
    ('MEDICO', 'animals:read', true),
    ('MEDICO', 'services:read', true),
    ('MEDICO', 'services:write', true),

    ('CONTADOR', 'services:read', true);

-- Migrate existing users to new role references
UPDATE "User" SET "roleId" = "role";

-- Enforce non-null constraint now that data is migrated
ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

-- Drop old role column and enum
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "RoleEnum";

-- Create indexes
CREATE UNIQUE INDEX "Module_slug_key" ON "Module"("slug");
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

-- Add foreign keys
ALTER TABLE "RoleModuleAccess"
  ADD CONSTRAINT "RoleModuleAccess_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleModuleAccess"
  ADD CONSTRAINT "RoleModuleAccess_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User"
  ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
