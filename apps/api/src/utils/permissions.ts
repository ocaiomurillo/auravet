import type { Module, RoleModuleAccess } from '@prisma/client';

export type ModuleAccess = RoleModuleAccess & { module: Module };

export const extractEnabledModuleSlugs = (accesses: ModuleAccess[]): string[] =>
  accesses
    .filter((access) => access.isEnabled && access.module.isActive)
    .map((access) => access.module.slug)
    .sort();

export const hasModule = (modules: string[], slug: string): boolean => modules.includes(slug);
