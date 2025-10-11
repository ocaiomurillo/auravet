import type { Role } from '@prisma/client';

export type Permission =
  | 'owners:read'
  | 'owners:write'
  | 'animals:read'
  | 'animals:write'
  | 'services:read'
  | 'services:write'
  | 'users:manage';

const permissionMap: Record<Role, Permission[]> = {
  ADMINISTRADOR: [
    'owners:read',
    'owners:write',
    'animals:read',
    'animals:write',
    'services:read',
    'services:write',
    'users:manage',
  ],
  AUXILIAR_ADMINISTRATIVO: ['owners:read', 'owners:write', 'animals:read', 'animals:write', 'services:read'],
  ASSISTENTE_ADMINISTRATIVO: ['owners:read', 'animals:read', 'services:read'],
  ENFERMEIRO: ['owners:read', 'animals:read', 'animals:write', 'services:read', 'services:write'],
  MEDICO: ['owners:read', 'animals:read', 'services:read', 'services:write'],
  CONTADOR: ['services:read'],
};

export const getRolePermissions = (role: Role): Permission[] => permissionMap[role];

export const hasPermission = (role: Role, permission: Permission): boolean =>
  permissionMap[role].includes(permission);
