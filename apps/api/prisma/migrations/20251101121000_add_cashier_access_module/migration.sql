-- Ensure cashier module exists and is active
INSERT INTO "Module" ("id", "name", "slug", "description", "isActive", "createdAt", "updatedAt")
VALUES ('cashier:access', 'Caixa', 'cashier:access', 'Permite gerenciar contas a receber e registrar pagamentos.', true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

UPDATE "Module"
SET "isActive" = true,
    "updatedAt" = NOW()
WHERE "id" = 'cashier:access';

-- Associate cashier module with the desired roles
INSERT INTO "RoleModuleAccess" ("roleId", "moduleId", "isEnabled") VALUES
    ('ADMINISTRADOR', 'cashier:access', true),
    ('AUXILIAR_ADMINISTRATIVO', 'cashier:access', true),
    ('ASSISTENTE_ADMINISTRATIVO', 'cashier:access', true),
    ('CONTADOR', 'cashier:access', true)
ON CONFLICT ("roleId", "moduleId") DO NOTHING;
