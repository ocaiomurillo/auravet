-- Ensure the canonical cashier module exists
INSERT INTO "Module" ("id", "name", "slug", "description", "isActive", "createdAt", "updatedAt")
VALUES ('cashier:manage', 'Caixa', 'cashier:manage', 'Permite gerenciar contas a receber e registrar pagamentos.', true, NOW(), NOW())
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name",
    "slug" = EXCLUDED."slug",
    "description" = EXCLUDED."description",
    "isActive" = true,
    "updatedAt" = NOW();

-- Remove possible duplicates before updating aliases
DELETE FROM "RoleModuleAccess" rma
WHERE rma."moduleId" = 'cashier:access'
  AND EXISTS (
    SELECT 1
    FROM "RoleModuleAccess" existing
    WHERE existing."roleId" = rma."roleId" AND existing."moduleId" = 'cashier:manage'
  );

-- Point legacy references to the canonical module
UPDATE "RoleModuleAccess"
SET "moduleId" = 'cashier:manage'
WHERE "moduleId" = 'cashier:access';

-- Remove the legacy module entry if it still exists
DELETE FROM "Module" WHERE "id" = 'cashier:access';
