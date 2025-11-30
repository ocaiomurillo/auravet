-- Ensure cashier module exists and is active
INSERT INTO "Module" ("id", "name", "slug", "description", "isActive", "createdAt", "updatedAt")
VALUES ('cashier:manage', 'Caixa', 'cashier:manage', 'Permite gerenciar contas a receber e registrar pagamentos.', true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

UPDATE "Module"
SET "isActive" = true,
    "updatedAt" = NOW()
WHERE "id" = 'cashier:manage';

-- Associate cashier module with the desired roles
INSERT INTO "RoleModuleAccess" ("roleId", "moduleId", "isEnabled") VALUES
    ('ADMINISTRADOR', 'cashier:manage', true),
    ('AUXILIAR_ADMINISTRATIVO', 'cashier:manage', true),
    ('ASSISTENTE_ADMINISTRATIVO', 'cashier:manage', true),
    ('CONTADOR', 'cashier:manage', true)
ON CONFLICT ("roleId", "moduleId") DO NOTHING;
