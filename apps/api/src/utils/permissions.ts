import type { Module, RoleModuleAccess } from '@prisma/client';

export type ModuleAccess = RoleModuleAccess & { module: Module };

export const cashierPermissionAliases = ['cashier:manage', 'cashier:access'] as const;

export const financePermissions = ['accounting:manage', ...cashierPermissionAliases] as const;

export const moduleAliases: Record<string, string[]> = {
  'animals:manage': ['animals:write'],
  'animals:write': ['animals:manage'],
  'attendances:manage': ['services:manage', 'services:write'],
  'attendances:read': ['services:read'],
  'cashier:access': ['cashier:manage'],
  'cashier:manage': ['cashier:access'],
  'owners:manage': ['owners:write'],
  'owners:write': ['owners:manage'],
  'products:manage': ['products:write'],
  'products:write': ['products:manage'],
  'appointments:manage': ['appointments:write'],
  'appointments:write': ['appointments:manage'],
  'services:manage': ['attendances:manage', 'services:write'],
  'services:read': ['attendances:read', 'attendances:manage'],
  'services:write': ['attendances:manage', 'services:manage'],
};

export const expandWithAliases = (modules: readonly string[]): string[] =>
  Array.from(new Set(modules.flatMap((module) => [module, ...(moduleAliases[module] ?? [])])));

export const extractEnabledModuleSlugs = (accesses: ModuleAccess[]): string[] =>
  accesses
    .filter((access) => access.isEnabled && access.module.isActive)
    .map((access) => access.module.slug)
    .sort();

export const hasModule = (modules: string[], slug: string): boolean =>
  expandWithAliases([slug]).some((candidate) => modules.includes(candidate));
