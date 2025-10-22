-- Ensure product modules exist and are active
INSERT INTO "Module" ("id", "name", "slug", "description", "isActive", "createdAt", "updatedAt")
VALUES
    ('products:read', 'Visualizar produtos', 'products:read', 'Permite acompanhar o catálogo e estoque de produtos.', true, NOW(), NOW()),
    ('products:write', 'Gerenciar produtos', 'products:write', 'Permite cadastrar produtos e ajustar estoque.', true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Associate product modules with the desired roles
INSERT INTO "RoleModuleAccess" ("roleId", "moduleId", "isEnabled") VALUES
    ('ADMINISTRADOR', 'products:read', true),
    ('ADMINISTRADOR', 'products:write', true),
    ('AUXILIAR_ADMINISTRATIVO', 'products:read', true),
    ('AUXILIAR_ADMINISTRATIVO', 'products:write', true),
    ('ASSISTENTE_ADMINISTRATIVO', 'products:read', true),
    ('ENFERMEIRO', 'products:read', true),
    ('ENFERMEIRO', 'products:write', true),
    ('MEDICO', 'products:read', true),
    ('CONTADOR', 'products:read', true)
ON CONFLICT ("roleId", "moduleId") DO NOTHING;
